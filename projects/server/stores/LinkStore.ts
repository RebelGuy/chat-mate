import { LinkAttempt, LinkToken, LinkType } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { LinkLog } from '@rebel/server/services/LinkService'
import { addTime } from '@rebel/server/util/datetime'
import { LinkAttemptInProgressError, UserAlreadyLinkedToAggregateUserError, UserNotLinkedError } from '@rebel/server/util/error'
import { randomString } from '@rebel/server/util/random'
import { ensureMaxTextWidth } from '@rebel/server/util/text'

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class LinkStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()

    this.db = deps.resolve('dbProvider').get()
  }

  /** Returns true if the given token is valid. */
  public async validateAndDeleteLinkToken (aggregateChatUserId: number, token: string): Promise<boolean> {
    const linkToken = await this.db.linkToken.findFirst({ where: {
      aggregateChatUserId: aggregateChatUserId,
      token: token
    }})

    if (linkToken == null) {
      return false
    }

    // todo: don't delete, just invalidate. this way, we have a history
    await this.db.linkToken.deleteMany({
      where: { token: linkToken.token }
    })

    return true
  }

  public async getOrCreateLinkToken (aggregateChatUserId: number, defaultChatUserId: number): Promise<LinkToken> {
    const linkToken = await this.db.linkToken.findFirst({ where: {
      aggregateChatUserId: aggregateChatUserId,
      defaultChatUserId: defaultChatUserId,
      OR: [{
        linkAttempt: null
      }, {
        // don't match completed link attempts that used this token
        linkAttempt: { endTime: { not: null }}
      }]
    }})

    if (linkToken != null) {
      return linkToken
    }

    return await this.db.linkToken.create({ data: {
      token: randomString(8),
      aggregateChatUserId: aggregateChatUserId,
      defaultChatUserId: defaultChatUserId
    }})
  }

  public async getAllLinkTokens (aggregateChatUserId: number) {
    return await this.db.linkToken.findMany({
      where: { aggregateChatUserId: aggregateChatUserId },
      include: { linkAttempt: true }
    })
  }

  /** Links the default user to the aggregate user.
   * @throws {@link UserAlreadyLinkedToAggregateUserError}: When the user is already linked to an aggregate user.
  */
  public async linkUser (defaultUserId: number, aggregateChatUserId: number): Promise<void> {
    const defaultUser = await this.db.chatUser.findUnique({
      where: { id: defaultUserId },
      rejectOnNotFound: true
    })

    if (defaultUser.aggregateChatUserId != null) {
      throw new UserAlreadyLinkedToAggregateUserError(`Cannot link the user because it is already linked to another user.`, defaultUser.aggregateChatUserId, defaultUserId)
    }

    await this.db.chatUser.update({
      where: { id: defaultUserId },
      data: {
        aggregateChatUserId: aggregateChatUserId,
        linkedAt: new Date()
      }
    })
  }

  /** Returns the created linkAttempt id.
   * @throws {@link LinkAttemptInProgressError}: When the default or aggregate user is already currently involved in a link/unlink attempt,
   * or if a previous attempt had failed and its state was not cleaned up.
  */
  public async startLinkAttempt (defaultUserId: number, aggregateUserId: number): Promise<number> {
    return await this.startLinkOrUnlinkAttempt(defaultUserId, aggregateUserId, 'link')
  }

  /** Returns the created linkAttempt id.
   * @throws {@link LinkAttemptInProgressError}: When the default or aggregate user is already currently involved in a link/unlink attempt,
   * or if a previous attempt had failed and its state was not cleaned up.
   * @throws {@link UserNotLinkedError}: When the default user is not currently linked to an aggregate user.
  */
  public async startUnlinkAttempt (defaultUserId: number): Promise<number> {
    const defaultUser = await this.db.chatUser.findUnique({
      where: { id: defaultUserId },
      rejectOnNotFound: true
    })

    if (defaultUser.aggregateChatUserId == null) {
      throw new UserNotLinkedError()
    }

    return await this.startLinkOrUnlinkAttempt(defaultUserId, defaultUser.aggregateChatUserId, 'unlink')
  }

  /** If `errorMessage` is null, it is implied that the link completed successfully, otherwise it is implied that it failed. */
  public async completeLinkAttempt (linkAttemptId: number, logs: LinkLog[], errorMessage: string | null) {
    await this.db.linkAttempt.update({
      where: { id: linkAttemptId },
      data: {
        endTime: new Date(),
        log: ensureMaxTextWidth(JSON.stringify(logs), 4096), // max length comes directly from the db - do not change this.
        errorMessage: errorMessage == null ? null : ensureMaxTextWidth(errorMessage, 4096) // max length comes directly from the db - do not change this.
      }
    })
  }

  public async deleteLinkAttempt (linkAttemptId: number) {
    await this.db.linkAttempt.delete({ where: { id: linkAttemptId }})
  }

  /** Returns the aggregate user's id that was unlinked. Throws if the user is not linked.
   * @throws {@link UserNotLinkedError}: When the default user is not currently linked to an aggregate user. */
  public async unlinkUser (defaultUserId: number): Promise<number> {
    const defaultUser = await this.db.chatUser.findUnique({
      where: { id: defaultUserId },
      rejectOnNotFound: true
    })

    if (defaultUser.aggregateChatUserId == null) {
      throw new UserNotLinkedError(`Cannot unlink the user because it is not linked to an aggregate user.`)
    }

    await this.db.chatUser.update({
      where: { id: defaultUserId },
      data: {
        aggregateChatUserId: null,
        linkedAt: null
      }
    })

    return defaultUser.aggregateChatUserId
  }

  private async startLinkOrUnlinkAttempt (defaultUserId: number, aggregateUserId: number, type: LinkType) {
    const existingAttempt = await this.db.linkAttempt.findFirst({
      where: {
        AND: [{
          OR: [
            { aggregateChatUserId: aggregateUserId },
            { defaultChatUserId: defaultUserId }
          ]
        }, {
          OR: [
            { endTime: null },

            // safety catch so that we don't half-complete a link, and then start it again. someone needs to look at what went wrong before giving the all-clear to re-attempt the link.
            { errorMessage: { not: null } }
          ]
        }]
      }
    })

    if (existingAttempt != null) {
      let message: string
      if (existingAttempt.errorMessage == null) {
        message = `Cannot ${type} the user. The user is currently being ${existingAttempt.type}ed (attempt id ${existingAttempt.id}). Please wait until this process is complete.`
      } else {
        message = `Cannot ${type} the user. An attempt was made to ${existingAttempt.type} the user previously, but it failed. Please contact an admin referncing the attempt id ${existingAttempt.id}.`
      }
      throw new LinkAttemptInProgressError(message)
    }

    const attempt = await this.db.linkAttempt.create({ data: {
      defaultChatUserId: defaultUserId,
      aggregateChatUserId: aggregateUserId,
      startTime: new Date(),
      log: 'Starting...',
      type: type
    }})
    return attempt.id
  }
}
