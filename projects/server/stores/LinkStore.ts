import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { LinkLog } from '@rebel/server/services/LinkService'
import { LinkAttemptInProgressError, UserAlreadyLinkedToAggregateUserError } from '@rebel/server/util/error'
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
   * @throws {@link LinkAttemptInProgressError}: When the default or aggregate user is already currently involved in a link attempt,
   * or if a previous attempt had failed and its state was not cleaned up.
  */
  public async startLinkAttempt (defaultUserId: number, aggregateUserId: number): Promise<number> {
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
        message = `The user is currently being linked (attempt id ${existingAttempt.id}). Please wait until this process is complete.`
      } else {
        message = `An attempt was made to link the user previously, but it failed. Please contact an admin referncing the attempt id ${existingAttempt.id}.`
      }
      throw new LinkAttemptInProgressError(message)
    }

    const attempt = await this.db.linkAttempt.create({ data: {
      defaultChatUserId: defaultUserId,
      aggregateChatUserId: aggregateUserId,
      startTime: new Date(),
      log: 'Starting...'
    }})
    return attempt.id
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
}
