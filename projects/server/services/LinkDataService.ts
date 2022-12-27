import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import CommandService from '@rebel/server/services/command/CommandService'
import LinkCommand from '@rebel/server/services/command/LinkCommand'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import LinkStore from '@rebel/server/stores/LinkStore'
import { Singular } from '@rebel/server/types'
import { NotFoundError } from 'typescript-rest/dist/server/model/errors'

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
})[]

type Deps = Dependencies<{
  linkStore: LinkStore
  commandService: CommandService
  linkCommand: LinkCommand
  channelStore: ChannelStore
}>

// split from `LinkService` because of circular dependencies
export default class LinkDataService extends ContextClass {
  private readonly linkStore: LinkStore
  private readonly commandService: CommandService
  private readonly linkCommand: LinkCommand
  private readonly channelStore: ChannelStore

  constructor (deps: Deps) {
    super()
    this.linkStore = deps.resolve('linkStore')
    this.commandService = deps.resolve('commandService')
    this.linkCommand = deps.resolve('linkCommand')
    this.channelStore = deps.resolve('channelStore')
  }

  public async getOrCreateLinkToken (aggregateUserId: number, externalChannelId: string) {
    const channel = await this.channelStore.getChannelFromExternalId(externalChannelId)
    if (channel == null) {
      throw new NotFoundError(`Unable to find a YouTube or Twitch channel with id ${externalChannelId}. Ensure the ID is correct and the channel has sent at least one chat message.`)
    }

    const defaultUserId = channel.userId
    return await this.linkStore.getOrCreateLinkToken(aggregateUserId, defaultUserId)
  }

  public async getLinkHistory (aggregateUserId: number): Promise<LinkHistory> {
    // todo: verify that the same def user can't be linked again, even if running another command.
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

    // add copmleted links - those that don't have a link attempt, or where the link attempt is not finished yet, will have been collected above.
    const historicTokens = await this.linkStore.getAllLinkTokens(aggregateUserId)
    linkHistory.push(...historicTokens.map<Singular<LinkHistory> | null>(t => {
      if (t.linkAttempt == null || t.linkAttempt.endTime == null) {
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
