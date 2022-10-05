import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import LogService from '@rebel/server/services/LogService'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import { InternalRankResult, SetActionRankResult, TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs } from '@rebel/server/stores/RankStore'

type Deps = Dependencies<{
  rankStore: RankStore
  channelStore: ChannelStore
  masterchatProxyService: MasterchatProxyService
  twurpleService: TwurpleService
  chatStore: ChatStore
  logService: LogService
}>

export default class ModService extends ContextClass {
  public readonly name = ModService.name

  private readonly rankStore: RankStore
  private readonly channelStore: ChannelStore
  private readonly masterchatProxyService: MasterchatProxyService
  private readonly twurpleService: TwurpleService
  private readonly chatStore: ChatStore
  private readonly logService: LogService

  constructor (deps: Deps) {
    super()

    this.rankStore = deps.resolve('rankStore')
    this.channelStore = deps.resolve('channelStore')
    this.masterchatProxyService = deps.resolve('masterchatProxyService')
    this.twurpleService = deps.resolve('twurpleService')
    this.chatStore = deps.resolve('chatStore')
    this.logService = deps.resolve('logService')
  }

  // todo: currently, ChatMate is assumed to be the source of truth of rank data.
  // should we also handle discrepancies between the data, e.g. when the external rank differs from the expected rank?

  /** Add or remove the mod user-rank and notify the external platforms. Doesn't throw. */
  public async setModRank (userId: number, isMod: boolean, message: string | null): Promise<SetActionRankResult> {
    const internalRankResult = await this.setInternalModRank(userId, isMod, message)

    // we have no way of knowing the _current_ external state (only from the previous message sent from that channel), so, to be safe, apply the rank
    // update to ALL of the user's channels and report back any errors that could arise from duplication.
    const userChannels = await this.channelStore.getUserOwnedChannels(userId)
    const youtubeResults = await Promise.all(userChannels.youtubeChannels.map(c => this.trySetYoutubeMod(c, isMod)))
    const twitchResults = await Promise.all(userChannels.twitchChannels.map(c => this.trySetTwitchMod(c, isMod)))

    return {
      rankResult: internalRankResult,
      youtubeResults: youtubeResults,
      twitchResults: twitchResults
    }
  }

  private async setInternalModRank (userId: number, isMod: boolean, message: string | null): Promise<InternalRankResult> {
    try {
      if (isMod) {
        const args: AddUserRankArgs = {
          userId: userId,
          rank: 'mod',
          expirationTime: null,
          message: message,
          assignee: null // todo: CHAT-385 use logged-in user details
        }
        return {
          rank: await this.rankStore.addUserRank(args),
          error: null
        }
      } else {
        const args: RemoveUserRankArgs = {
          userId: userId,
          rank: 'mod',
          message: message,
          removedBy: null // todo: CHAT-385 use logged-in user details
        }
        return {
          rank: await this.rankStore.removeUserRank(args),
          error: null
        }
      }
    } catch (e: any) {
      return {
        rank: null,
        error: e.message
      }
    }
  }

  private async trySetYoutubeMod (youtubeChannelId: number, isMod: boolean): Promise<YoutubeRankResult> {
    const lastChatItem = await this.chatStore.getLastChatByYoutubeChannel(youtubeChannelId)

    const errorSuffix = ' If this is unexpected, please retry the action. Failure to do so may lead to an out-of-sync state with undefined behaviour.'
    const type = isMod ? 'mod' : 'unmod'
    if (lastChatItem == null) {
      const error = `Could not ${type} youtube channel ${youtubeChannelId} because no chat item was found for the channel.` + errorSuffix
      this.logService.logWarning(this, error)
      return { error, youtubeChannelId }
    } else if (lastChatItem.contextToken == null) {
      const error = `Could not ${type} youtube channel ${youtubeChannelId} because the most recent chat item did not contain a context token.` + errorSuffix
      this.logService.logWarning(this, error)
      return { error, youtubeChannelId }
    }

    let error: string | null = null
    try {
      let result: boolean
      if (isMod) {
        result = await this.masterchatProxyService.mod(lastChatItem.contextToken)
      } else {
        result = await this.masterchatProxyService.unmod(lastChatItem.contextToken)
      }

      this.logService.logInfo(this, `Request to ${type} youtube channel ${youtubeChannelId} succeeded. Action applied: ${result}`)
      if (!result) {
        error = `Request succeeded, but action was not applied. Most likely, the user is already ${type}ded.` + errorSuffix
      }
    } catch (e: any) {
      this.logService.logError(this, `Request to ${type} youtube channel ${youtubeChannelId} failed:`, e.message)
      error = e.message + errorSuffix
    }

    return { error, youtubeChannelId }
  }

  private async trySetTwitchMod (twitchChannelId: number, isMod: boolean): Promise<TwitchRankResult> {
    const type = isMod ? 'mod' : 'unmod'
    const errorSuffix = ' If this is unexpected, please retry the action. Failure to do so may lead to an out-of-sync state with undefined behaviour.'
    let error: string | null = null
    try {
      // if the rank is already applied, twitch will just send a Notice message which we can ignore
      if (isMod) {
        await this.twurpleService.modChannel(twitchChannelId)
      } else {
        await this.twurpleService.unmodChannel(twitchChannelId)
      }

      this.logService.logInfo(this, `Request to ${type} twitch channel ${twitchChannelId} succeeded.`)
    } catch (e: any) {
      this.logService.logWarning(this, `Request to ${type} twitch channel ${twitchChannelId} failed:`, e.message)

      // `chatClient.onNotice` will have the actual error, but we probably know what the issue is
      const message = e.message ?? (isMod ? `Channel is likely already a moderator.` : `Channel is likely not a moderator.`)
      error = message + errorSuffix
    }

    return { error, twitchChannelId }
  }
}
