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

  public async addLinkAttemptToLinkToken (linkToken: string, linkAttemptId: number) {
    // this seems weird... should the schema be changed to reverse the relationship?
    await this.db.linkToken.update({
      where: { token: linkToken },
      data: { linkAttempt: { connect: { id: linkAttemptId }}}
    })
  }

  /** Returns true if the given token is valid. A valid token is one that has been saved against the default user, and has not been previously used to link the users. */
  public async validateLinkToken (defaultChatUserId: number, token: string): Promise<LinkToken | null> {
    const linkToken = await this.db.linkToken.findFirst({
      where: {
        defaultChatUserId: defaultChatUserId,
        token: token
      },
      include: { linkAttempt: true }
    })

    // token doesn't exist or has already been used up
    if (linkToken == null || linkToken.linkAttempt != null) {
      return null
    } else {
      return linkToken
    }
  }

  public async getOrCreateLinkToken (aggregateChatUserId: number, defaultChatUserId: number): Promise<LinkToken> {
    const linkToken = await this.db.linkToken.findFirst({ where: {
      aggregateChatUserId: aggregateChatUserId,
      defaultChatUserId: defaultChatUserId,
      OR: [{
        linkAttempt: null
      }, {
        // don't match completed link attempts that used this token
        linkAttempt: { endTime: null }
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

  /** Returns only link attempts that do not have a link token attached to them (i.e. that were not initiated by a command). */
  public async getAllStandaloneLinkAttempts (aggregateChatUserId: number) {
    return await this.db.linkAttempt.findMany({
      where: {
        aggregateChatUserId: aggregateChatUserId,
        linkToken: null
      }
    })
  }

  public async isLinkInProgress (anyUserId: number): Promise<boolean> {
    const linkAttempt = await this.db.linkAttempt.findFirst({ where: {
      OR: [
        { aggregateChatUserId: anyUserId, endTime: null },
        { defaultChatUserId: anyUserId, endTime: null }
      ]
    }})

    return linkAttempt != null
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
      throw new UserAlreadyLinkedToAggregateUserError(`Cannot link the user because it is already linked to ${defaultUser.aggregateChatUserId === aggregateChatUserId ? 'this' : 'another'} user.`, defaultUser.aggregateChatUserId, defaultUserId)
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
      throw new UserNotLinkedError('The user is not linked.')
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
        errorMessage: errorMessage == null ? null : ensureMaxTextWidth(errorMessage, 4096), // max length comes directly from the db - do not change this.
        released: errorMessage == null
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
            {
              errorMessage: { not: null },
              released: false
            }
          ]
        }]
      }
    })

    if (existingAttempt != null) {
      let message: string
      if (existingAttempt.errorMessage == null) {
        message = `Cannot ${type} the user. The user is currently being ${existingAttempt.type}ed (attempt id ${existingAttempt.id}). Please wait until this process is complete.`
      } else {
        message = `Cannot ${type} the user. An attempt was made to ${existingAttempt.type} the user previously, but it failed. Please contact an admin referencing the attempt id ${existingAttempt.id}.`
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
