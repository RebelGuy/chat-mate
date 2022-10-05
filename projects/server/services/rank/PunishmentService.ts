import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import LogService from '@rebel/server/services/LogService'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import YoutubeTimeoutRefreshService from '@rebel/server/services/YoutubeTimeoutRefreshService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import RankStore, { AddUserRankArgs, groupFilter, RemoveUserRankArgs, UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { addTime } from '@rebel/server/util/datetime'
import { assert, assertUnreachable } from '@rebel/server/util/typescript'
import { InternalRankResult, SetActionRankResult, TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import { UserRankAlreadyExistsError, UserRankNotFoundError } from '@rebel/server/util/error'

// It is not an issue on Twitch, but on Youtube we come across the interesting problem of being unable to check
// the current list of on-platform punishments. This means that, when a punishment occurrs, the platform data
// may not be in sync with the DB data. Therefore, when a new punishment is requested in this service, we will
// attempt to apply the on-platform punishment, and then add or refresh (revoke and re-apply) the punishment
// in the DB. This way, we are guaranteed that data is always in sync after a new punishment has been requested
// (assuming the external request succeeded).
// Finally, while it is not an error to request the same punishment multiple times in succession, it should
// generally be avoided to reduce clutter in the punishment history of the user.
// The public methods are set up in such a way that there can only ever be one active punishment per user per type.

// Note that Youtube timeouts invariably last for 5 minutes, but can be refreshed to achieve longer timeouts.
// We use the YoutubeTimeoutRefreshService to help us achieve this.

type Deps = Dependencies<{
  logService: LogService
  masterchatProxyService: MasterchatProxyService
  twurpleService: TwurpleService
  channelStore: ChannelStore
  rankStore: RankStore
  chatStore: ChatStore
  youtubeTimeoutRefreshService: YoutubeTimeoutRefreshService
}>

export default class PunishmentService extends ContextClass {
  public readonly name = PunishmentService.name

  private readonly logService: LogService
  private readonly masterchat: MasterchatProxyService
  private readonly twurpleService: TwurpleService
  private readonly rankStore: RankStore
  private readonly channelStore: ChannelStore
  private readonly chatStore: ChatStore
  private readonly youtubeTimeoutRefreshService: YoutubeTimeoutRefreshService

  constructor (deps: Deps) {
    super()

    this.logService = deps.resolve('logService')
    this.masterchat = deps.resolve('masterchatProxyService')
    this.twurpleService = deps.resolve('twurpleService')
    this.rankStore = deps.resolve('rankStore')
    this.channelStore = deps.resolve('channelStore')
    this.chatStore = deps.resolve('chatStore')
    this.youtubeTimeoutRefreshService = deps.resolve('youtubeTimeoutRefreshService')
  }

  public override async initialise () {
    const currentPunishments = await this.getCurrentPunishments()
    const timeouts = currentPunishments.filter(p => p.rank.name === 'timeout')

    // this never throws an error even if any of the promises reject
    await Promise.allSettled(timeouts.map(t => this.youtubeTimeoutRefreshService.startTrackingTimeout(
      t.id,
      t.expirationTime!,
      true,
      () => this.onRefreshTimeoutForYoutube(t)
    )))
  }

  public async getCurrentPunishments (): Promise<UserRankWithRelations[]> {
    return await this.rankStore.getUserRanksForGroup('punishment')
  }

  public async getPunishmentHistory (userId: number): Promise<UserRankWithRelations[]> {
    const history = await this.rankStore.getUserRankHistory(userId)
    return groupFilter(history, 'punishment')
  }

  public async banUser (userId: number, message: string | null): Promise<SetActionRankResult> {
    const args: AddUserRankArgs = {
      rank: 'ban',
      message: message,
      userId: userId,
      expirationTime: null,
      assignee: null // todo: CHAT-385 use logged-in user details
    }
    const rankResult = await this.addInternalRank(args)

    const ownedChannels = await this.channelStore.getUserOwnedChannels(userId)
    const youtubeResults = await Promise.all(ownedChannels.youtubeChannels.map(c => this.tryApplyYoutubePunishment(c, 'ban')))
    const twitchResults = await Promise.all(ownedChannels.twitchChannels.map(c => this.tryApplyTwitchPunishment(c, message, 'ban')))

    return { rankResult, youtubeResults, twitchResults }
  }

  public async isUserPunished (userId: number): Promise<boolean> {
    const currentPunishments = await this.getCurrentPunishmentsForUser(userId)
    return currentPunishments.ranks.length > 0
  }

  /** Mutes are used only in ChatMate and not relayed to Youtube or Twitch.
   * @throws {@link UserRankAlreadyExistsError}: When a user-rank of that type is already active. */
  public async muteUser (userId: number, message: string | null, durationSeconds: number | null): Promise<UserRankWithRelations> {
    const now = new Date()
    const args: AddUserRankArgs = {
      rank: 'mute',
      expirationTime: durationSeconds == null ? null : addTime(now, 'seconds', durationSeconds),
      message: message,
      userId: userId,
      assignee: null // todo: CHAT-385 use logged-in user details
    }
    return await this.rankStore.addUserRank(args)
  }

  /** Applies an actual timeout that is relayed to Youtube or Twitch. */
  public async timeoutUser (userId: number, message: string | null, durationSeconds: number): Promise<SetActionRankResult> {
    const now = new Date()
    const args: AddUserRankArgs = {
      rank: 'timeout',
      expirationTime: addTime(now, 'seconds', durationSeconds),
      message: message,
      userId: userId,
      assignee: null // todo: CHAT-385 use logged-in user details
    }
    const rankResult = await this.addInternalRank(args)

    const ownedChannels = await this.channelStore.getUserOwnedChannels(userId)
    const youtubeResults = await Promise.all(ownedChannels.youtubeChannels.map(c => this.tryApplyYoutubePunishment(c, 'timeout')))
    const twitchResults = await Promise.all(ownedChannels.twitchChannels.map(c => this.tryApplyTwitchPunishment(c, message, 'timeout', durationSeconds)))

    if (rankResult.rank != null) {
      const rank = rankResult.rank
      this.youtubeTimeoutRefreshService.startTrackingTimeout(rank.id, rank.expirationTime!, false, () => this.onRefreshTimeoutForYoutube(rank))
    }

    return { rankResult, youtubeResults, twitchResults }
  }

  /** Returns the updated punishment, if there was one. */
  public async unbanUser (userId: number, unbanMessage: string | null): Promise<SetActionRankResult> {
    const args: RemoveUserRankArgs = {
      rank: 'ban',
      userId: userId,
      message: unbanMessage,
      removedBy: null // todo: CHAT-385 use logged-in user details
    }
    const rankResult = await this.removeInternalRank(args)

    const ownedChannels = await this.channelStore.getUserOwnedChannels(userId)
    const youtubeResults = await Promise.all(ownedChannels.youtubeChannels.map(c => this.tryApplyYoutubePunishment(c, 'unban')))
    const twitchResults = await Promise.all(ownedChannels.twitchChannels.map(c => this.tryApplyTwitchPunishment(c, unbanMessage, 'unban')))

    return { rankResult, youtubeResults, twitchResults }
  }

  public async unmuteUser (userId: number, revokeMessage: string | null): Promise<UserRankWithRelations> {
    const args: RemoveUserRankArgs = {
      rank: 'mute',
      userId: userId,
      message: revokeMessage,
      removedBy: null // todo: CHAT-385 use logged-in user details
    }
    return await this.rankStore.removeUserRank(args)
  }

  public async untimeoutUser (userId: number, revokeMessage: string | null): Promise<SetActionRankResult> {
    const args: RemoveUserRankArgs = {
      rank: 'timeout',
      userId: userId,
      message: revokeMessage,
      removedBy: null // todo: CHAT-385 use logged-in user details
    }
    const rankResult = await this.removeInternalRank(args)

    if (rankResult.rank != null) {
      this.youtubeTimeoutRefreshService.stopTrackingTimeout(rankResult.rank.id)
    }

    const ownedChannels = await this.channelStore.getUserOwnedChannels(userId)
    const twitchResults = await Promise.all(ownedChannels.twitchChannels.map(c => this.tryApplyTwitchPunishment(c, revokeMessage, 'untimeout')))
    const youtubeResults: YoutubeRankResult[] = ownedChannels.youtubeChannels.map(c => ({ youtubeChannelId: c, error: 'YouTube timeouts expire automatically 5 minutes after they were last applied.'}))

    return { rankResult, youtubeResults, twitchResults }
  }

  /** Re-applies the timeout on Youtube. Note that the timeout always lasts for 5 minutes. */
  private async onRefreshTimeoutForYoutube (timeout: UserRankWithRelations) {
    const ownedChannels = await this.channelStore.getUserOwnedChannels(timeout.userId)
    await Promise.all(ownedChannels.youtubeChannels.map(c => this.tryApplyYoutubePunishment(c, 'refreshTimeout')))
  }

  private async getCurrentPunishmentsForUser (userId: number) {
    const allRanks = await this.rankStore.getUserRanks([userId])
    return groupFilter(allRanks, 'punishment')[0]
  }

  private async addInternalRank (args: AddUserRankArgs): Promise<InternalRankResult> {
    try {
      return {
        rank: await this.rankStore.addUserRank(args),
        error: null
      }
    } catch (e: any) {
      return {
        rank: null,
        error: e.message
      }
    }
  }

  private async removeInternalRank (args: RemoveUserRankArgs): Promise<InternalRankResult> {
    try {
      return {
        rank: await this.rankStore.removeUserRank(args),
        error: null
      }
    } catch (e: any) {
      return {
        rank: null,
        error: e.message
      }
    }
  }

  private async tryApplyYoutubePunishment (youtubeChannelId: number, type: 'ban' | 'unban' | 'timeout' | 'refreshTimeout'): Promise<YoutubeRankResult> {
    const lastChatItem = await this.chatStore.getLastChatByYoutubeChannel(youtubeChannelId)

    if (lastChatItem == null) {
      const error = `Could not ${type} youtube channel ${youtubeChannelId} because no chat item was found for the channel`
      this.logService.logWarning(this, error)
      return { error, youtubeChannelId }
    } else if (lastChatItem.contextToken == null) {
      const error = `Could not ${type} youtube channel ${youtubeChannelId} because the most recent chat item did not contain a context token`
      this.logService.logWarning(this, error)
      return { error, youtubeChannelId }
    }

    let error: string | null = null
    try {
      let result: boolean
      if (type === 'ban') {
        result = await this.masterchat.banYoutubeChannel(lastChatItem.contextToken)
      } else if (type === 'unban') {
        result = await this.masterchat.unbanYoutubeChannel(lastChatItem.contextToken)
      } else if (type === 'timeout' || type === 'refreshTimeout') {
        result = await this.masterchat.timeout(lastChatItem.contextToken)
      } else {
        assertUnreachable(type)
      }

      this.logService.logInfo(this, `Request to ${type} youtube channel ${youtubeChannelId} succeeded. Action applied: ${result}`)
      if (!result) {
        error = `Request succeeded, but action was not applied.`
      }
    } catch (e: any) {
      this.logService.logError(this, `Request to ${type} youtube channel ${youtubeChannelId} failed:`, e.message)
      error = e.message
    }

    return { error, youtubeChannelId }
  }

  private async tryApplyTwitchPunishment (twitchChannelId: number, reason: string | null, type: 'ban' | 'unban' | 'timeout' | 'untimeout', durationSeconds?: number): Promise<TwitchRankResult> {
    let error: string | null = null
    try {
      // if the punishment is already applied, twitch will just send a Notice message which we can ignore
      if (type === 'ban') {
        await this.twurpleService.banChannel(twitchChannelId, reason)
      } else if (type === 'unban') {
        await this.twurpleService.unbanChannel(twitchChannelId)
      } else if (type === 'timeout') {
        assert(durationSeconds != null, 'Timeout duration must be defined')
        await this.twurpleService.timeout(twitchChannelId, reason, durationSeconds)
      } else if (type === 'untimeout') {
        await this.twurpleService.untimeout(twitchChannelId, reason)
      } else {
        assertUnreachable(type)
      }

      this.logService.logInfo(this, `Request to ${type} twitch channel ${twitchChannelId} succeeded.`)
    } catch (e: any) {
      this.logService.logError(this, `Request to ${type} twitch channel ${twitchChannelId} failed:`, e.message)
      error = e.message
    }

    return { error, twitchChannelId }
  }
}
