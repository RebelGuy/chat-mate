import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import LogService from '@rebel/server/services/LogService'
import MasterchatService from '@rebel/server/services/MasterchatService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import YoutubeTimeoutRefreshService from '@rebel/server/services/YoutubeTimeoutRefreshService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import RankStore, { AddUserRankArgs, groupFilter, RemoveUserRankArgs, UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { addTime } from '@rebel/shared/util/datetime'
import { assert, assertUnreachable } from '@rebel/shared/util/typescript'
import { InternalRankResult, SetActionRankResult, TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { single } from '@rebel/shared/util/arrays'
import UserService from '@rebel/server/services/UserService'

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
  masterchatService: MasterchatService
  twurpleService: TwurpleService
  channelStore: ChannelStore
  rankStore: RankStore
  chatStore: ChatStore
  youtubeTimeoutRefreshService: YoutubeTimeoutRefreshService
  streamerStore: StreamerStore
  userService: UserService
}>

export default class PunishmentService extends ContextClass {
  public readonly name = PunishmentService.name

  private readonly logService: LogService
  private readonly masterchat: MasterchatService
  private readonly twurpleService: TwurpleService
  private readonly rankStore: RankStore
  private readonly channelStore: ChannelStore
  private readonly chatStore: ChatStore
  private readonly youtubeTimeoutRefreshService: YoutubeTimeoutRefreshService
  private readonly streamerStore: StreamerStore
  private readonly userService: UserService

  constructor (deps: Deps) {
    super()

    this.logService = deps.resolve('logService')
    this.masterchat = deps.resolve('masterchatService')
    this.twurpleService = deps.resolve('twurpleService')
    this.rankStore = deps.resolve('rankStore')
    this.channelStore = deps.resolve('channelStore')
    this.chatStore = deps.resolve('chatStore')
    this.youtubeTimeoutRefreshService = deps.resolve('youtubeTimeoutRefreshService')
    this.streamerStore = deps.resolve('streamerStore')
    this.userService = deps.resolve('userService')
  }

  public override async initialise () {
    const streamers = await this.streamerStore.getStreamers()
    // todo: this is not scalable
    const currentPunishments = await Promise.all(streamers.map(s => this.getCurrentPunishments(s.id))).then(result => result.flatMap(x => x))
    const timeouts = currentPunishments.filter(p => p.rank.name === 'timeout')

    // this never throws an error even if any of the promises reject
    await Promise.allSettled(timeouts.map(t => this.youtubeTimeoutRefreshService.startTrackingTimeout(
      t.id,
      t.expirationTime!,
      true,
      () => this.onRefreshTimeoutForYoutube(t.streamerId, t.primaryUserId)
    )))
  }

  public async getCurrentPunishments (streamerId: number): Promise<UserRankWithRelations[]> {
    return await this.rankStore.getUserRanksForGroup('punishment', streamerId)
  }

  public async getPunishmentHistory (primaryUserId: number, streamerId: number): Promise<UserRankWithRelations[]> {
    const history = await this.rankStore.getUserRankHistory(primaryUserId, streamerId)
    return groupFilter(history, 'punishment')
  }

  public async banUser (primaryUserId: number, streamerId: number, moderatorPrimaryUserId: number | null, message: string | null): Promise<SetActionRankResult> {
    if (await this.userService.isUserBusy(primaryUserId)) {
      throw new Error('Cannot ban the user at this time. Please try again later.')
    }

    const args: AddUserRankArgs = {
      rank: 'ban',
      message: message,
      primaryUserId: primaryUserId,
      streamerId: streamerId,
      expirationTime: null,
      assignee: moderatorPrimaryUserId
    }
    const rankResult = await this.addInternalRank(args)

    const ownedChannels = await this.channelStore.getConnectedUserOwnedChannels([primaryUserId]).then(single)
    const youtubeResults = await Promise.all(ownedChannels.youtubeChannelIds.map(c => this.tryApplyYoutubePunishment(streamerId, c, 'ban')))
    const twitchResults = await Promise.all(ownedChannels.twitchChannelIds.map(c => this.tryApplyTwitchPunishment(streamerId, c, message, 'ban')))

    return { rankResult, youtubeResults, twitchResults }
  }

  /** Like `banUser` except we don't make any changes to UserRanks, and does not take into account any other users connected to this one. */
  public async banUserExternal (defaultUserId: number, streamerId: number, message: string | null): Promise<Omit<SetActionRankResult, 'rankResult'>> {
    const ownedChannels = await this.channelStore.getDefaultUserOwnedChannels([defaultUserId]).then(single)
    const youtubeResults = await Promise.all(ownedChannels.youtubeChannelIds.map(c => this.tryApplyYoutubePunishment(streamerId, c, 'ban')))
    const twitchResults = await Promise.all(ownedChannels.twitchChannelIds.map(c => this.tryApplyTwitchPunishment(streamerId, c, message, 'ban')))

    return { youtubeResults, twitchResults }
  }

  public async isUserPunished (primaryUserId: number, streamerId: number): Promise<boolean> {
    const currentPunishments = await this.getCurrentPunishmentsForUser(primaryUserId, streamerId)
    return currentPunishments.ranks.length > 0
  }

  /** Mutes are used only in ChatMate and not relayed to Youtube or Twitch.
   * @throws {@link UserRankAlreadyExistsError}: When a user-rank of that type is already active. */
  public async muteUser (primaryUserId: number, streamerId: number, moderatorPrimaryUserId: number | null, message: string | null, durationSeconds: number | null): Promise<UserRankWithRelations> {
    if (await this.userService.isUserBusy(primaryUserId)) {
      throw new Error('Cannot mute the user at this time. Please try again later.')
    }

    const now = new Date()
    const args: AddUserRankArgs = {
      rank: 'mute',
      expirationTime: durationSeconds == null ? null : addTime(now, 'seconds', durationSeconds),
      message: message,
      primaryUserId: primaryUserId,
      streamerId: streamerId,
      assignee: moderatorPrimaryUserId
    }
    return await this.rankStore.addUserRank(args)
  }

  /** Applies an actual timeout that is relayed to Youtube or Twitch. */
  public async timeoutUser (primaryUserId: number, streamerId: number, moderatorPrimaryUserId: number | null, message: string | null, durationSeconds: number): Promise<SetActionRankResult> {
    if (await this.userService.isUserBusy(primaryUserId)) {
      throw new Error('Cannot timeout the user at this time. Please try again later.')
    }

    const now = new Date()
    const args: AddUserRankArgs = {
      rank: 'timeout',
      expirationTime: addTime(now, 'seconds', durationSeconds),
      message: message,
      primaryUserId: primaryUserId,
      streamerId: streamerId,
      assignee: moderatorPrimaryUserId
    }
    const rankResult = await this.addInternalRank(args)

    const ownedChannels = await this.channelStore.getConnectedUserOwnedChannels([primaryUserId]).then(single)
    const youtubeResults = await Promise.all(ownedChannels.youtubeChannelIds.map(c => this.tryApplyYoutubePunishment(streamerId, c, 'timeout')))
    const twitchResults = await Promise.all(ownedChannels.twitchChannelIds.map(c => this.tryApplyTwitchPunishment(streamerId, c, message, 'timeout', durationSeconds)))

    if (rankResult.rank != null) {
      const rank = rankResult.rank
      this.youtubeTimeoutRefreshService.startTrackingTimeout(rank.id, rank.expirationTime!, false, () => this.onRefreshTimeoutForYoutube(rank.streamerId, rank.primaryUserId))
    }

    return { rankResult, youtubeResults, twitchResults }
  }

  /** Like `timeoutUser` except we don't make changes to UserRanks, and does not take into account any other users connected to this one. Must provide the `rankId` of the internal rank so. */
  public async timeoutUserExternal (defaultUserId: number, streamerId: number, rankId: number, message: string | null, durationSeconds: number): Promise<Omit<SetActionRankResult, 'rankResult'>> {
    const ownedChannels = await this.channelStore.getDefaultUserOwnedChannels([defaultUserId]).then(single)
    const youtubeResults = await Promise.all(ownedChannels.youtubeChannelIds.map(c => this.tryApplyYoutubePunishment(streamerId, c, 'timeout')))
    const twitchResults = await Promise.all(ownedChannels.twitchChannelIds.map(c => this.tryApplyTwitchPunishment(streamerId, c, message, 'timeout', durationSeconds)))

    this.youtubeTimeoutRefreshService.startTrackingTimeout(rankId, addTime(new Date(), 'seconds', durationSeconds), false, () => this.onRefreshTimeoutForYoutube(streamerId, defaultUserId))

    return { youtubeResults, twitchResults }
  }

  /** Returns the updated punishment, if there was one. */
  public async unbanUser (primaryUserId: number, streamerId: number, moderatorPrimaryUserId: number | null, unbanMessage: string | null): Promise<SetActionRankResult> {
    if (await this.userService.isUserBusy(primaryUserId)) {
      throw new Error('Cannot unban the user at this time. Please try again later.')
    }

    const args: RemoveUserRankArgs = {
      rank: 'ban',
      primaryUserId: primaryUserId,
      streamerId: streamerId,
      message: unbanMessage,
      removedBy: moderatorPrimaryUserId
    }
    const rankResult = await this.removeInternalRank(args)

    const ownedChannels = await this.channelStore.getConnectedUserOwnedChannels([primaryUserId]).then(single)
    const youtubeResults = await Promise.all(ownedChannels.youtubeChannelIds.map(c => this.tryApplyYoutubePunishment(streamerId, c, 'unban')))
    const twitchResults = await Promise.all(ownedChannels.twitchChannelIds.map(c => this.tryApplyTwitchPunishment(streamerId, c, unbanMessage, 'unban')))

    return { rankResult, youtubeResults, twitchResults }
  }

  public async unmuteUser (primaryUserId: number, streamerId: number, moderatorPrimaryUserId: number | null, revokeMessage: string | null): Promise<UserRankWithRelations> {
    if (await this.userService.isUserBusy(primaryUserId)) {
      throw new Error('Cannot unmute the user at this time. Please try again later.')
    }

    const args: RemoveUserRankArgs = {
      rank: 'mute',
      primaryUserId: primaryUserId,
      streamerId: streamerId,
      message: revokeMessage,
      removedBy: moderatorPrimaryUserId
    }
    return await this.rankStore.removeUserRank(args)
  }

  public async untimeoutUser (primaryUserId: number, streamerId: number, moderatorPrimaryUserId: number | null, revokeMessage: string | null): Promise<SetActionRankResult> {
    if (await this.userService.isUserBusy(primaryUserId)) {
      throw new Error('Cannot un-timeout the user at this time. Please try again later.')
    }

    const args: RemoveUserRankArgs = {
      rank: 'timeout',
      primaryUserId: primaryUserId,
      streamerId: streamerId,
      message: revokeMessage,
      removedBy: moderatorPrimaryUserId
    }
    const rankResult = await this.removeInternalRank(args)

    if (rankResult.rank != null) {
      this.youtubeTimeoutRefreshService.stopTrackingTimeout(rankResult.rank.id)
    }

    const ownedChannels = await this.channelStore.getConnectedUserOwnedChannels([primaryUserId]).then(single)
    const twitchResults = await Promise.all(ownedChannels.twitchChannelIds.map(c => this.tryApplyTwitchPunishment(streamerId, c, revokeMessage, 'untimeout')))
    const youtubeResults: YoutubeRankResult[] = ownedChannels.youtubeChannelIds.map(c => ({ youtubeChannelId: c, error: 'YouTube timeouts expire automatically 5 minutes after they were last applied.'}))

    return { rankResult, youtubeResults, twitchResults }
  }

  /** Like `untimeoutUser` except we don't make changes to UserRanks, and does not take into account any other users connected to this one. Must provide the `rankId` of the internal rank that is/was linked to the user's timeout. */
  public async untimeoutUserExternal (defaultUserId: number, streamerId: number, rankId: number, revokeMessage: string | null): Promise<Omit<SetActionRankResult, 'rankResult'>> {
    this.youtubeTimeoutRefreshService.stopTrackingTimeout(rankId)

    const ownedChannels = await this.channelStore.getDefaultUserOwnedChannels([defaultUserId]).then(single)
    const twitchResults = await Promise.all(ownedChannels.twitchChannelIds.map(c => this.tryApplyTwitchPunishment(streamerId, c, revokeMessage, 'untimeout')))
    const youtubeResults: YoutubeRankResult[] = ownedChannels.youtubeChannelIds.map(c => ({ youtubeChannelId: c, error: 'YouTube timeouts expire automatically 5 minutes after they were last applied.'}))

    return { youtubeResults, twitchResults }
  }

  /** Re-applies the timeout on Youtube. Note that the timeout always lasts for 5 minutes. */
  private async onRefreshTimeoutForYoutube (streamerId: number | null, anyUserId: number) {
    if (streamerId == null) {
      throw new Error(`Cannot refresh the YouTube timeout of user ${anyUserId} because no streamerId was supplied, and timeout ranks cannot be global.`)
    }

    const ownedChannels = await this.channelStore.getConnectedUserOwnedChannels([anyUserId]).then(single)
    await Promise.all(ownedChannels.youtubeChannelIds.map(c => this.tryApplyYoutubePunishment(streamerId!, c, 'refreshTimeout')))
  }

  private async getCurrentPunishmentsForUser (primaryUserId: number, streamerId: number) {
    const allRanks = await this.rankStore.getUserRanks([primaryUserId], streamerId)
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

  private async tryApplyYoutubePunishment (streamerId: number, youtubeChannelId: number, type: 'ban' | 'unban' | 'timeout' | 'refreshTimeout'): Promise<YoutubeRankResult> {
    const lastChatItem = await this.chatStore.getLastChatByYoutubeChannel(streamerId, youtubeChannelId)

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
        result = await this.masterchat.banYoutubeChannel(streamerId, lastChatItem.contextToken)
      } else if (type === 'unban') {
        result = await this.masterchat.unbanYoutubeChannel(streamerId, lastChatItem.contextToken)
      } else if (type === 'timeout' || type === 'refreshTimeout') {
        result = await this.masterchat.timeout(streamerId, lastChatItem.contextToken)
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

  private async tryApplyTwitchPunishment (streamerId: number, twitchChannelId: number, reason: string | null, type: 'ban' | 'unban' | 'timeout' | 'untimeout', durationSeconds?: number): Promise<TwitchRankResult> {
    let error: string | null = null
    try {
      // if the punishment is already applied, twitch will just send a Notice message which we can ignore
      if (type === 'ban') {
        await this.twurpleService.banChannel(streamerId, twitchChannelId, reason)
      } else if (type === 'unban') {
        await this.twurpleService.unbanChannel(streamerId, twitchChannelId)
      } else if (type === 'timeout') {
        assert(durationSeconds != null, 'Timeout duration must be defined')
        await this.twurpleService.timeout(streamerId, twitchChannelId, reason, durationSeconds)
      } else if (type === 'untimeout') {
        await this.twurpleService.untimeout(streamerId, twitchChannelId)
      } else {
        assertUnreachable(type)
      }

      this.logService.logInfo(this, `Request to ${type} twitch channel ${twitchChannelId} for streamer ${streamerId} succeeded.`)
    } catch (e: any) {
      this.logService.logError(this, `Request to ${type} twitch channel ${twitchChannelId} for streamer ${streamerId} failed:`, e.message)
      error = e.message
    }

    return { error, twitchChannelId }
  }
}
