import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import LogService from '@rebel/server/services/LogService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import RankStore, { AddUserRankArgs, groupFilter, RankEventData, RemoveUserRankArgs, UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { addTime } from '@rebel/shared/util/datetime'
import { assert, assertUnreachable } from '@rebel/shared/util/typescript'
import { InternalRankResult, SetActionRankResult, TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import { single } from '@rebel/shared/util/arrays'
import UserService from '@rebel/server/services/UserService'
import YoutubeService from '@rebel/server/services/YoutubeService'
import { ChatMateError } from '@rebel/shared/util/error'
import { SafeOmit } from '@rebel/shared/types'

export type IgnoreOptions = {
  youtubeChannelId?: number
  twitchChannelId?: number
}

// It is not an issue on Twitch, but on Youtube we come across the interesting problem of being unable to check
// the current list of on-platform punishments. This means that, when a punishment occurrs, the platform data
// may not be in sync with the DB data. Therefore, when a new punishment is requested in this service, we will
// attempt to apply the on-platform punishment, and then add or refresh (revoke and re-apply) the punishment
// in the DB. This way, we are guaranteed that data is always in sync after a new punishment has been requested
// (assuming the external request succeeded).
// The public methods are set up in such a way that there can only ever be one active punishment per user per type.

type Deps = Dependencies<{
  logService: LogService
  twurpleService: TwurpleService
  channelStore: ChannelStore
  rankStore: RankStore
  userService: UserService
  youtubeService: YoutubeService
}>

export default class PunishmentService extends ContextClass {
  public readonly name = PunishmentService.name

  private readonly logService: LogService
  private readonly twurpleService: TwurpleService
  private readonly rankStore: RankStore
  private readonly channelStore: ChannelStore
  private readonly userService: UserService
  private readonly youtubeService: YoutubeService

  constructor (deps: Deps) {
    super()

    this.logService = deps.resolve('logService')
    this.twurpleService = deps.resolve('twurpleService')
    this.rankStore = deps.resolve('rankStore')
    this.channelStore = deps.resolve('channelStore')
    this.userService = deps.resolve('userService')
    this.youtubeService = deps.resolve('youtubeService')
  }

  public async getCurrentPunishments (streamerId: number): Promise<UserRankWithRelations[]> {
    return await this.rankStore.getUserRanksForGroup('punishment', streamerId)
  }

  public async getPunishmentHistory (primaryUserId: number, streamerId: number): Promise<UserRankWithRelations[]> {
    const history = await this.rankStore.getUserRankHistory(primaryUserId, streamerId)
    return groupFilter(history, 'punishment')
  }

  public async banUser (primaryUserId: number, streamerId: number, moderatorPrimaryUserId: number | null, message: string | null, ignoreOptions: IgnoreOptions | null): Promise<SetActionRankResult> {
    if (await this.userService.isUserBusy(primaryUserId)) {
      throw new ChatMateError('Cannot ban the user at this time. Please try again later.')
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
    const youtubeResults = await Promise.all(ownedChannels.youtubeChannelIds
      .filter(id => ignoreOptions?.youtubeChannelId !== id)
      .map(c => this.tryApplyYoutubePunishment(streamerId, c, 'ban')))
    const twitchResults = await Promise.all(ownedChannels.twitchChannelIds
      .filter(id => ignoreOptions?.twitchChannelId !== id)
      .map(c => this.tryApplyTwitchPunishment(streamerId, c, message, 'ban')))

    const rankEventData: RankEventData = {
      version: 1,
      youtubeRankResults: youtubeResults,
      twitchRankResults: twitchResults,
      ignoreOptions: ignoreOptions
    }
    this.rankStore.addRankEvent(streamerId, primaryUserId, true, 'ban', rankEventData)

    return { rankResult, youtubeResults, twitchResults }
  }

  /** Like `banUser` except we don't make any changes to UserRanks, and does not take into account any other users connected to this one. */
  public async banUserExternal (defaultUserId: number, streamerId: number, message: string | null): Promise<SafeOmit<SetActionRankResult, 'rankResult'>> {
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
      throw new ChatMateError('Cannot mute the user at this time. Please try again later.')
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
    const rank = await this.rankStore.addUserRank(args)

    this.rankStore.addRankEvent(streamerId, primaryUserId, true, 'mute', null)

    return rank
  }

  /** Applies an actual timeout that is relayed to Youtube or Twitch. */
  public async timeoutUser (primaryUserId: number, streamerId: number, moderatorPrimaryUserId: number | null, message: string | null, durationSeconds: number, ignoreOptions: IgnoreOptions | null): Promise<SetActionRankResult> {
    if (await this.userService.isUserBusy(primaryUserId)) {
      throw new ChatMateError('Cannot timeout the user at this time. Please try again later.')
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
    const youtubeResults = await Promise.all(ownedChannels.youtubeChannelIds
      .filter(id => ignoreOptions?.youtubeChannelId !== id)
      .map(c => this.tryApplyYoutubePunishment(streamerId, c, 'timeout', durationSeconds)))
    const twitchResults = await Promise.all(ownedChannels.twitchChannelIds
      .filter(id => ignoreOptions?.twitchChannelId !== id)
      .map(c => this.tryApplyTwitchPunishment(streamerId, c, message, 'timeout', durationSeconds)))

    const rankEventData: RankEventData = {
      version: 1,
      youtubeRankResults: youtubeResults,
      twitchRankResults: twitchResults,
      ignoreOptions: ignoreOptions
    }
    this.rankStore.addRankEvent(streamerId, primaryUserId, true, 'timeout', rankEventData)

    return { rankResult, youtubeResults, twitchResults }
  }

  /** Like `timeoutUser` except we don't make changes to UserRanks, and does not take into account any other users connected to this one. Must provide the `rankId` of the internal rank so. */
  public async timeoutUserExternal (defaultUserId: number, streamerId: number, rankId: number, message: string | null, durationSeconds: number): Promise<SafeOmit<SetActionRankResult, 'rankResult'>> {
    const ownedChannels = await this.channelStore.getDefaultUserOwnedChannels([defaultUserId]).then(single)
    const youtubeResults = await Promise.all(ownedChannels.youtubeChannelIds.map(c => this.tryApplyYoutubePunishment(streamerId, c, 'timeout', durationSeconds)))
    const twitchResults = await Promise.all(ownedChannels.twitchChannelIds.map(c => this.tryApplyTwitchPunishment(streamerId, c, message, 'timeout', durationSeconds)))

    return { youtubeResults, twitchResults }
  }

  /** Returns the updated punishment, if there was one. */
  public async unbanUser (primaryUserId: number, streamerId: number, moderatorPrimaryUserId: number | null, unbanMessage: string | null, ignoreOptions: IgnoreOptions | null): Promise<SetActionRankResult> {
    if (await this.userService.isUserBusy(primaryUserId)) {
      throw new ChatMateError('Cannot unban the user at this time. Please try again later.')
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
    const youtubeResults = await Promise.all(ownedChannels.youtubeChannelIds
      .filter(id => ignoreOptions?.youtubeChannelId !== id)
      .map(c => this.tryApplyYoutubePunishment(streamerId, c, 'unban')))
    const twitchResults = await Promise.all(ownedChannels.twitchChannelIds
      .filter(id => ignoreOptions?.twitchChannelId !== id)
      .map(c => this.tryApplyTwitchPunishment(streamerId, c, unbanMessage, 'unban')))

    const rankEventData: RankEventData = {
      version: 1,
      youtubeRankResults: youtubeResults,
      twitchRankResults: twitchResults,
      ignoreOptions: ignoreOptions
    }
    this.rankStore.addRankEvent(streamerId, primaryUserId, false, 'ban', rankEventData)

    return { rankResult, youtubeResults, twitchResults }
  }

  public async unmuteUser (primaryUserId: number, streamerId: number, moderatorPrimaryUserId: number | null, revokeMessage: string | null): Promise<UserRankWithRelations> {
    if (await this.userService.isUserBusy(primaryUserId)) {
      throw new ChatMateError('Cannot unmute the user at this time. Please try again later.')
    }

    const args: RemoveUserRankArgs = {
      rank: 'mute',
      primaryUserId: primaryUserId,
      streamerId: streamerId,
      message: revokeMessage,
      removedBy: moderatorPrimaryUserId
    }
    const rank = await this.rankStore.removeUserRank(args)

    this.rankStore.addRankEvent(streamerId, primaryUserId, false, 'mute', null)

    return rank
  }

  public async untimeoutUser (primaryUserId: number, streamerId: number, moderatorPrimaryUserId: number | null, revokeMessage: string | null, ignoreOptions: IgnoreOptions | null): Promise<SetActionRankResult> {
    if (await this.userService.isUserBusy(primaryUserId)) {
      throw new ChatMateError('Cannot un-timeout the user at this time. Please try again later.')
    }

    const args: RemoveUserRankArgs = {
      rank: 'timeout',
      primaryUserId: primaryUserId,
      streamerId: streamerId,
      message: revokeMessage,
      removedBy: moderatorPrimaryUserId
    }
    const rankResult = await this.removeInternalRank(args)

    const ownedChannels = await this.channelStore.getConnectedUserOwnedChannels([primaryUserId]).then(single)
    const youtubeResults = await Promise.all(ownedChannels.youtubeChannelIds
      .filter(id => ignoreOptions?.youtubeChannelId !== id)
      .map(c => this.tryApplyYoutubePunishment(streamerId, c, 'untimeout')))
    const twitchResults = await Promise.all(ownedChannels.twitchChannelIds
      .filter(id => ignoreOptions?.twitchChannelId !== id)
      .map(c => this.tryApplyTwitchPunishment(streamerId, c, revokeMessage, 'untimeout')))

    const rankEventData: RankEventData = {
      version: 1,
      youtubeRankResults: youtubeResults,
      twitchRankResults: twitchResults,
      ignoreOptions: ignoreOptions
    }
    this.rankStore.addRankEvent(streamerId, primaryUserId, false, 'timeout', rankEventData)

    return { rankResult, youtubeResults, twitchResults }
  }

  /** Like `untimeoutUser` except we don't make changes to UserRanks, and does not take into account any other users connected to this one. Must provide the `rankId` of the internal rank that is/was linked to the user's timeout. */
  public async untimeoutUserExternal (defaultUserId: number, streamerId: number, rankId: number, revokeMessage: string | null): Promise<SafeOmit<SetActionRankResult, 'rankResult'>> {
    const ownedChannels = await this.channelStore.getDefaultUserOwnedChannels([defaultUserId]).then(single)
    const twitchResults = await Promise.all(ownedChannels.twitchChannelIds.map(c => this.tryApplyTwitchPunishment(streamerId, c, revokeMessage, 'untimeout')))
    const youtubeResults = await Promise.all(ownedChannels.youtubeChannelIds.map(c => this.tryApplyYoutubePunishment(streamerId, c, 'untimeout')))

    return { youtubeResults, twitchResults }
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

  private async tryApplyYoutubePunishment (streamerId: number, youtubeChannelId: number, type: 'ban' | 'unban' | 'untimeout'): Promise<YoutubeRankResult>
  private async tryApplyYoutubePunishment (streamerId: number, youtubeChannelId: number, type: 'timeout', durationSeconds: number): Promise<YoutubeRankResult>
  private async tryApplyYoutubePunishment (streamerId: number, youtubeChannelId: number, type: 'ban' | 'unban' | 'timeout' | 'untimeout', durationSeconds?: number): Promise<YoutubeRankResult> {
    let error: string | null = null
    try {
      if (type === 'ban') {
        await this.youtubeService.banYoutubeChannel(streamerId, youtubeChannelId)
      } else if (type === 'unban') {
        await this.youtubeService.unbanYoutubeChannel(streamerId, youtubeChannelId)
      } else if (type === 'timeout') {
        await this.youtubeService.timeoutYoutubeChannel(streamerId, youtubeChannelId, durationSeconds!)
      } else if (type === 'untimeout') {
        await this.youtubeService.untimeoutYoutubeChannel(streamerId, youtubeChannelId)
      } else {
        assertUnreachable(type)
      }

      this.logService.logInfo(this, `Request to ${type} youtube channel ${youtubeChannelId} succeeded.`)
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
