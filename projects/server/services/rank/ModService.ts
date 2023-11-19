import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import LogService from '@rebel/server/services/LogService'
import { InternalRankResult, SetActionRankResult, TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import UserService from '@rebel/server/services/UserService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs } from '@rebel/server/stores/RankStore'
import { single } from '@rebel/shared/util/arrays'
import YoutubeService from '@rebel/server/services/YoutubeService'

type Deps = Dependencies<{
  rankStore: RankStore
  channelStore: ChannelStore
  twurpleService: TwurpleService
  logService: LogService
  userService: UserService
  youtubeService: YoutubeService
}>

export default class ModService extends ContextClass {
  public readonly name = ModService.name

  private readonly rankStore: RankStore
  private readonly channelStore: ChannelStore
  private readonly twurpleService: TwurpleService
  private readonly logService: LogService
  private readonly userService: UserService
  private readonly youtubeService: YoutubeService

  constructor (deps: Deps) {
    super()

    this.rankStore = deps.resolve('rankStore')
    this.channelStore = deps.resolve('channelStore')
    this.twurpleService = deps.resolve('twurpleService')
    this.logService = deps.resolve('logService')
    this.userService = deps.resolve('userService')
    this.youtubeService = deps.resolve('youtubeService')
  }

  // todo: currently, ChatMate is assumed to be the source of truth of rank data.
  // should we also handle discrepancies between the data, e.g. when the external rank differs from the expected rank?

  /** Add or remove the mod user-rank and notify the external platforms. Doesn't throw. */
  public async setModRank (primaryUserId: number, streamerId: number, loggedInRegisteredUserId: number | null, isMod: boolean, message: string | null): Promise<SetActionRankResult> {
    if (await this.userService.isUserBusy(primaryUserId)) {
      throw new Error(`Cannot ${isMod ? 'mod' : 'unmod'} the user at this time. Please try again later.`)
    }

    const internalRankResult = await this.setInternalModRank(primaryUserId, streamerId, loggedInRegisteredUserId, isMod, message)

    // we have no way of knowing the _current_ external state (only from the previous message sent from that channel), so, to be safe, apply the rank
    // update to ALL of the user's channels and report back any errors that could arise from duplication.
    const userChannels = await this.channelStore.getConnectedUserOwnedChannels([primaryUserId]).then(single)
    const youtubeResults = await Promise.all(userChannels.youtubeChannelIds.map(c => this.trySetYoutubeMod(streamerId, c, isMod)))
    const twitchResults = await Promise.all(userChannels.twitchChannelIds.map(c => this.trySetTwitchMod(streamerId, c, isMod)))

    return {
      rankResult: internalRankResult,
      youtubeResults: youtubeResults,
      twitchResults: twitchResults
    }
  }

  /** Like `setModRank` except we don't make changes to UserRanks, and does not take into account any other users connected to this one. */
  public async setModRankExternal (defaultUserId: number, streamerId: number, isMod: boolean): Promise<Omit<SetActionRankResult, 'rankResult'>> {
    const userChannels = await this.channelStore.getDefaultUserOwnedChannels([defaultUserId]).then(single)
    const youtubeResults = await Promise.all(userChannels.youtubeChannelIds.map(c => this.trySetYoutubeMod(streamerId, c, isMod)))
    const twitchResults = await Promise.all(userChannels.twitchChannelIds.map(c => this.trySetTwitchMod(streamerId, c, isMod)))

    return {
      youtubeResults: youtubeResults,
      twitchResults: twitchResults
    }
  }

  private async setInternalModRank (primaryUserId: number, streamerId: number, moderatorPrimaryUserId: number | null, isMod: boolean, message: string | null): Promise<InternalRankResult> {
    try {
      if (isMod) {
        const args: AddUserRankArgs = {
          primaryUserId: primaryUserId,
          streamerId: streamerId,
          rank: 'mod',
          expirationTime: null,
          message: message,
          assignee: moderatorPrimaryUserId
        }
        return {
          rank: await this.rankStore.addUserRank(args),
          error: null
        }
      } else {
        const args: RemoveUserRankArgs = {
          primaryUserId: primaryUserId,
          streamerId: streamerId,
          rank: 'mod',
          message: message,
          removedBy: moderatorPrimaryUserId
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

  private async trySetYoutubeMod (streamerId: number, youtubeChannelId: number, isMod: boolean): Promise<YoutubeRankResult> {
    const errorSuffix = ' If this is unexpected, please retry the action. Failure to do so may lead to an out-of-sync state with undefined behaviour.'
    const type = isMod ? 'mod' : 'unmod'
    let error: string | null = null
    try {
      if (isMod) {
        await this.youtubeService.modYoutubeChannel(streamerId, youtubeChannelId)
      } else {
        await this.youtubeService.unmodYoutubeChannel(streamerId, youtubeChannelId)
      }

      this.logService.logInfo(this, `Request to ${type} youtube channel ${youtubeChannelId} succeeded.`)
    } catch (e: any) {
      this.logService.logError(this, `Request to ${type} youtube channel ${youtubeChannelId} failed:`, e.message)
      error = e.message + errorSuffix
    }

    return { error, youtubeChannelId }
  }

  private async trySetTwitchMod (streamerId: number, twitchChannelId: number, isMod: boolean): Promise<TwitchRankResult> {
    const type = isMod ? 'mod' : 'unmod'
    const errorSuffix = ' If this is unexpected, please retry the action. Failure to do so may lead to an out-of-sync state with undefined behaviour.'
    let error: string | null = null
    try {
      // if the rank is already applied, twitch will just send a Notice message which we can ignore
      if (isMod) {
        await this.twurpleService.modChannel(streamerId, twitchChannelId)
      } else {
        await this.twurpleService.unmodChannel(streamerId, twitchChannelId)
      }

      this.logService.logInfo(this, `Request to ${type} twitch channel ${twitchChannelId} for streamer ${streamerId} succeeded.`)
    } catch (e: any) {
      this.logService.logWarning(this, `Request to ${type} twitch channel ${twitchChannelId} for streamer ${streamerId} failed:`, e.message)

      // `chatClient.onNotice` will have the actual error, but we probably know what the issue is
      const message = e.message ?? (isMod ? `Channel is likely already a moderator.` : `Channel is likely not a moderator.`)
      error = message + errorSuffix
    }

    return { error, twitchChannelId }
  }
}
