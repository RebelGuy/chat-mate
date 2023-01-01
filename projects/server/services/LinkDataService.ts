import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import CommandService from '@rebel/server/services/command/CommandService'
import LinkCommand from '@rebel/server/services/command/LinkCommand'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import LinkStore from '@rebel/server/stores/LinkStore'
import { Singular } from '@rebel/server/types'
import AccountStore from '@rebel/server/stores/AccountStore'
import { NotFoundError, UserAlreadyLinkedToAggregateUserError } from '@rebel/server/util/error'

export type LinkHistory = ({
  type: 'pending' | 'running'
  // no guarantee that this is a valid token - it is inferred from the command arguments
  maybeToken: string
  defaultUserId: number
} | {
  type: 'fail' | 'success'
  defaultUserId: number
  completionTime: Date
  message: string
  token: string
} | {
  type: 'waiting' // waiting for the user to execute the link
  defaultUserId: number
  token: string
})[]

type Deps = Dependencies<{
  linkStore: LinkStore
  commandService: CommandService
  linkCommand: LinkCommand
  channelStore: ChannelStore
  accountStore: AccountStore
}>

// split from `LinkService` because of circular dependencies
export default class LinkDataService extends ContextClass {
  private readonly linkStore: LinkStore
  private readonly commandService: CommandService
  private readonly linkCommand: LinkCommand
  private readonly channelStore: ChannelStore
  private readonly accountStore: AccountStore

  constructor (deps: Deps) {
    super()
    this.linkStore = deps.resolve('linkStore')
    this.commandService = deps.resolve('commandService')
    this.linkCommand = deps.resolve('linkCommand')
    this.channelStore = deps.resolve('channelStore')
    this.accountStore = deps.resolve('accountStore')
  }

  /**
   * @throws {@link NotFoundError}: When no YouTube or Twitch channel was found with the given external ID.
   * @throws {@link UserAlreadyLinkedToAggregateUserError}: When the specified channel is already linked to the aggregate user.
  */
  public async getOrCreateLinkToken (aggregateUserId: number, externalChannelId: string) {
    const channel = await this.channelStore.getChannelFromExternalId(externalChannelId)
    if (channel == null) {
      throw new NotFoundError(`Unable to find a YouTube or Twitch channel with id ${externalChannelId}. Ensure the ID is correct and the channel has sent at least one chat message.`)
    }

    const defaultUserId = channel.userId

    // don't bother going ahead if the users are already linked
    const connectedUserIds = await this.accountStore.getConnectedChatUserIds(defaultUserId)
    if (connectedUserIds[0] === aggregateUserId) {
      throw new UserAlreadyLinkedToAggregateUserError(`Channel ${externalChannelId} is already linked to user ${aggregateUserId}`, aggregateUserId, defaultUserId)
    }

    return await this.linkStore.getOrCreateLinkToken(aggregateUserId, defaultUserId)
  }

  public async getLinkHistory (aggregateUserId: number): Promise<LinkHistory> {
    let linkHistory: LinkHistory = this.commandService.getQueuedCommands()
      .filter(c => this.linkCommand.normalisedNames.includes(c.normalisedName))
      .map(c => ({ type: 'pending', defaultUserId: c.userId, maybeToken: c.arguments[0] ?? '' }))

    const runningCommand = this.commandService.getRunningCommand()
    if (runningCommand != null && this.linkCommand.normalisedNames.includes(runningCommand.normalisedName)) {
      linkHistory.push({
        type: 'running',
        defaultUserId: runningCommand.userId,
        maybeToken: runningCommand.arguments[0] ?? ''
      })
    }

    // add completed links - those that don't have a link attempt, or where the link attempt is not finished yet, will have been collected above.
    const historicTokens = await this.linkStore.getAllLinkTokens(aggregateUserId)
    linkHistory.push(...historicTokens.map<Singular<LinkHistory> | null>(t => {
      if (t.linkAttempt == null) {
        return {
          type: 'waiting',
          defaultUserId: t.defaultChatUserId,
          token: t.token
        }
      } else if (t.linkAttempt.endTime == null) {
        return null
      } else {
        return {
          type: t.linkAttempt.errorMessage == null ? 'success' : 'fail',
          completionTime: t.linkAttempt.endTime,
          defaultUserId: t.defaultChatUserId,
          message: t.linkAttempt.errorMessage ?? 'Link succeeded',
          token: t.token
        }
      }
    }).filter(x => x != null) as LinkHistory) // why `filter` doesn't change the type of the array is beyond me

    return linkHistory
  }
}
