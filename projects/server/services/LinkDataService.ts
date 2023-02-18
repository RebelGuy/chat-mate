import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import CommandService from '@rebel/server/services/command/CommandService'
import LinkCommand from '@rebel/server/services/command/LinkCommand'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import LinkStore from '@rebel/server/stores/LinkStore'
import { Singular } from '@rebel/shared/types'
import AccountStore from '@rebel/server/stores/AccountStore'
import { NotFoundError, UserAlreadyLinkedToAggregateUserError } from '@rebel/shared/util/error'
import { single } from '@rebel/shared/util/arrays'
import AccountService from '@rebel/server/services/AccountService'

export type LinkHistory = ({
  isLink: boolean
  defaultUserId: number
} & ({
  type: 'pending' | 'running'
  // no guarantee that this is a valid token - it is inferred from the command arguments, if link was initiated by a command.
  maybeToken: string | null
} | {
  type: 'fail' | 'success'
  completionTime: Date
  message: string
  // only set if link was initiated by a command
  token: string | null
} | {
  type: 'waiting' // waiting for the user to execute the link
  // only set if link was initiated by a command
  token: string | null
}))[]

type Deps = Dependencies<{
  linkStore: LinkStore
  commandService: CommandService
  linkCommand: LinkCommand
  channelStore: ChannelStore
  accountService: AccountService
}>

// split from `LinkService` because of circular dependencies
export default class LinkDataService extends ContextClass {
  private readonly linkStore: LinkStore
  private readonly commandService: CommandService
  private readonly linkCommand: LinkCommand
  private readonly channelStore: ChannelStore
  private readonly accountService: AccountService

  constructor (deps: Deps) {
    super()
    this.linkStore = deps.resolve('linkStore')
    this.commandService = deps.resolve('commandService')
    this.linkCommand = deps.resolve('linkCommand')
    this.channelStore = deps.resolve('channelStore')
    this.accountService = deps.resolve('accountService')
  }

  /**
   * @throws {@link NotFoundError}: When no YouTube or Twitch channel was found with the given external ID.
   * @throws {@link UserAlreadyLinkedToAggregateUserError}: When the specified channel is already linked to the aggregate user.
  */
  public async getOrCreateLinkToken (aggregateUserId: number, externalChannelIdOrUserName: string) {
    const channel = await this.channelStore.getChannelFromUserNameOrExternalId(externalChannelIdOrUserName)
    if (channel == null) {
      throw new NotFoundError(`Unable to find a YouTube or Twitch channel with id ${externalChannelIdOrUserName}. Ensure the ID is correct and the channel has sent at least one chat message.`)
    }

    const defaultUserId = channel.userId

    // don't bother going ahead if the users are already linked
    const primaryUserId = single(await this.accountService.getPrimaryUserIdFromAnyUser([defaultUserId]))
    if (primaryUserId === aggregateUserId) {
      throw new UserAlreadyLinkedToAggregateUserError(`Channel ${externalChannelIdOrUserName} is already linked to user ${aggregateUserId}`, aggregateUserId, defaultUserId)
    }

    return await this.linkStore.getOrCreateLinkToken(aggregateUserId, defaultUserId)
  }

  /** Returns all link tokens and link attempts, and groups them where applicable. */
  public async getLinkHistory (aggregateUserId: number): Promise<LinkHistory> {
    let linkHistory: LinkHistory = this.commandService.getQueuedCommands()
      .filter(c => this.linkCommand.normalisedNames.includes(c.normalisedName))
      .map(c => ({
        type: 'pending',
        defaultUserId: c.defaultUserId,
        maybeToken: c.arguments[0] ?? '',
        isLink: true // we don't allow unlinking via commands
      }))

    const runningCommand = this.commandService.getRunningCommand()
    if (runningCommand != null && this.linkCommand.normalisedNames.includes(runningCommand.normalisedName)) {
      linkHistory.push({
        type: 'running',
        defaultUserId: runningCommand.defaultUserId,
        maybeToken: runningCommand.arguments[0] ?? '',
        isLink: true // we don't allow unlinking via commands
      })
    }

    // add completed links, or attempts that are not running as part of a command.
    // tokens that don't have a link attempt, or where the link attempt is not finished yet, will have been collected above.

    // link attempts that don't have a token attached to it have been initiated manually (i.e. not as part of a command)
    // note that the standalone link attempts, and link attempts attached to link tokens, are mutually exclusive. we don't need to check for duplicates.
    const linkAttempts = await this.linkStore.getAllStandaloneLinkAttempts(aggregateUserId)
    linkHistory.push(...linkAttempts.map<Singular<LinkHistory>>(a => {
      if (a.endTime == null) {
        return {
          type: 'running',
          defaultUserId: a.defaultChatUserId,
          maybeToken: null,
          isLink: a.type === 'link'
        }
      } else {
        return {
          type: a.errorMessage == null ? 'success' : 'fail',
          completionTime: a.endTime,
          defaultUserId: a.defaultChatUserId,
          message: a.errorMessage ?? 'Success',
          token: null,
          isLink: a.type === 'link'
        }
      }
    }))

    const linkTokens = await this.linkStore.getAllLinkTokens(aggregateUserId)
    linkHistory.push(...linkTokens.map<Singular<LinkHistory> | null>(t => {
      if (t.linkAttempt == null) {
        return {
          type: 'waiting',
          defaultUserId: t.defaultChatUserId,
          token: t.token,
          isLink: true // we don't allow unlinking via commands
        }
      } else if (t.linkAttempt.endTime == null) {
        return null
      } else {
        return {
          type: t.linkAttempt.errorMessage == null ? 'success' : 'fail',
          completionTime: t.linkAttempt.endTime,
          defaultUserId: t.defaultChatUserId,
          message: t.linkAttempt.errorMessage ?? 'Success',
          token: t.token,
          isLink: true // we don't allow unlinking via commands
        }
      }
    }).filter(x => x != null) as LinkHistory) // why `filter` doesn't change the type of the array is beyond me

    return linkHistory
  }
}
