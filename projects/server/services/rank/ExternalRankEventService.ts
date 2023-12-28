import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import LogService from '@rebel/server/services/LogService'
import PunishmentService, { IgnoreOptions } from '@rebel/server/services/rank/PunishmentService'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import ModService from '@rebel/server/services/rank/ModService'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import AccountStore from '@rebel/server/stores/AccountStore'
import { single } from '@rebel/shared/util/arrays'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ExternalRankDataService from '@rebel/server/services/rank/ExternalRankDataService'
import RankStore from '@rebel/server/stores/RankStore'

type Deps = Dependencies<{
  logService: LogService
  punishmentService: PunishmentService
  dateTimeHelpers: DateTimeHelpers
  modService: ModService
  streamerStore: StreamerStore
  accountStore: AccountStore
  channelStore: ChannelStore
  externalRankDataService: ExternalRankDataService
  rankStore: RankStore
}>

export default class ExternalRankEventService extends ContextClass {
  public readonly name = ExternalRankEventService.name

  private readonly logService: LogService
  private readonly punishmentService: PunishmentService
  private readonly dateTimeHelpers: DateTimeHelpers
  private readonly modService: ModService
  private readonly streamerStore: StreamerStore
  private readonly accountStore: AccountStore
  private readonly channelStore: ChannelStore
  private readonly externalRankDataService: ExternalRankDataService
  private readonly rankStore: RankStore

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.punishmentService = deps.resolve('punishmentService')
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
    this.modService = deps.resolve('modService')
    this.streamerStore = deps.resolve('streamerStore')
    this.accountStore = deps.resolve('accountStore')
    this.channelStore = deps.resolve('channelStore')
    this.externalRankDataService = deps.resolve('externalRankDataService')
    this.rankStore = deps.resolve('rankStore')
  }

  // for these methods, it is assumed that all internal and external ranks were in sync at the time when the external rank was changed

  public async onTwitchChannelBanned (streamerId: number, channelName: string, moderatorChannelName: string, reason: string, endTime: number | null): Promise<void> {
    const data = await this.externalRankDataService.getTwitchDataForExternalRankEvent(streamerId, channelName, moderatorChannelName, 'punishment')
    if (data == null) {
      this.logService.logWarning(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was banned/timed out, but could not find channel. Ignoring.`)
      return
    }

    const { primaryUserId, channelId, ranksForUser, moderatorPrimaryUserId } = data
    const ignoreOptions: IgnoreOptions = { twitchChannelId: channelId }

    // if the user has other channels, it will cause this event to fire for those channels as well. since the first thing we do
    // when applying a punishment is create a ChatMate rank, we don't have to worry about infinite loops here.
    if (endTime == null && ranksForUser.find(r => r.rank.name === 'ban') == null) {
      this.logService.logInfo(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was banned. Syncing punishment.`)
      await this.punishmentService.banUser(primaryUserId, streamerId, moderatorPrimaryUserId, reason, ignoreOptions)
    } else if (endTime != null && ranksForUser.find(r => r.rank.name === 'timeout') == null) {
      const durationSeconds = Math.round((endTime - this.dateTimeHelpers.ts()) / 1000)
      if (durationSeconds > 0) {
        this.logService.logInfo(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was timed out for ${durationSeconds}. Syncing punishment.`)
        await this.punishmentService.timeoutUser(primaryUserId, streamerId, moderatorPrimaryUserId, reason, durationSeconds, ignoreOptions)
      } else {
        this.logService.logInfo(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was timed out, but internal punishment is already active. Ignoring.`)
      }
    } else {
      this.logService.logInfo(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was banned/timed out, but internal punishment is already active. Ignoring.`)
    }
  }

  public async onTwitchChannelModded (streamerId: number, channelName: string): Promise<void> {
    const data = await this.externalRankDataService.getTwitchDataForExternalRankEvent(streamerId, channelName, null, 'administration')
    if (data == null) {
      this.logService.logWarning(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was modded, but could not find channel. Ignoring.`)
      return
    }

    const { primaryUserId, ranksForUser, channelId } = data

    if (ranksForUser.find(r => r.rank.name === 'mod') == null) {
      this.logService.logInfo(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was modded. Syncing mod rank.`)

      const ignoreOptions: IgnoreOptions = { twitchChannelId: channelId }
      const streamer = await this.streamerStore.getStreamerById(streamerId)
      const streamerPrimaryUserId = await this.accountStore.getRegisteredUsersFromIds([streamer!.registeredUserId]).then(user => single(user).aggregateChatUserId)

      await this.modService.setModRank(primaryUserId, streamerId, streamerPrimaryUserId, true, null, ignoreOptions)
    } else {
      this.logService.logInfo(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was modded, but internal mod rank is already active. Ignoring.`)
    }
  }

  public async onTwitchChannelUnbanned (streamerId: number, channelName: string, moderatorChannelName: string): Promise<void> {
    const data = await this.externalRankDataService.getTwitchDataForExternalRankEvent(streamerId, channelName, moderatorChannelName, 'punishment')
    if (data == null) {
      this.logService.logWarning(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was unbanned/untimed out, but could not find channel. Ignoring.`)
      return
    }

    const { primaryUserId, channelId, ranksForUser, moderatorPrimaryUserId } = data
    const ignoreOptions: IgnoreOptions = { twitchChannelId: channelId }

    // I think technically this doesn't work consistently/cleanly if the user is both banned and timed out internally, but only timed out on Twitch. in that case, removing the
    // ban rank will remove the Twitch punishment, but trigger another unban event before the internal timeout rank was removed. This means one of the two event handlers may
    // very well fail, but I think it's not an issue considering the rarity of the situation
    const requiresBanSync = ranksForUser.find(r => r.rank.name === 'ban') != null
    const requiresTimeoutSync = ranksForUser.find(r => r.rank.name === 'timeout') != null

    if (requiresBanSync || requiresTimeoutSync) {
      this.logService.logInfo(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was unbanned. Syncing ban/timeout punishments.`)
    } else {
      this.logService.logInfo(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was unbanned, but an internal ban/timeout punishment is not active. Ignoring.`)
    }

    if (requiresBanSync) {
      await this.punishmentService.unbanUser(primaryUserId, streamerId, moderatorPrimaryUserId, null, ignoreOptions)
    }
    if (requiresTimeoutSync) {
      await this.punishmentService.untimeoutUser(primaryUserId, streamerId, moderatorPrimaryUserId, null, ignoreOptions)
    }
  }

  public async onTwitchChannelUnmodded (streamerId: number, channelName: string): Promise<void> {
    const data = await this.externalRankDataService.getTwitchDataForExternalRankEvent(streamerId, channelName, null, 'administration')
    if (data == null) {
      this.logService.logWarning(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was unmodded, but could not find channel. Ignoring.`)
      return
    }

    const { primaryUserId, ranksForUser, channelId } = data

    if (ranksForUser.find(r => r.rank.name === 'mod') != null) {
      this.logService.logInfo(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was unmodded. Syncing mod rank.`)

      const ignoreOptions: IgnoreOptions = { twitchChannelId: channelId }
      const streamer = await this.streamerStore.getStreamerById(streamerId)
      const streamerPrimaryUserId = await this.accountStore.getRegisteredUsersFromIds([streamer!.registeredUserId]).then(user => single(user).aggregateChatUserId)

      await this.modService.setModRank(primaryUserId, streamerId, streamerPrimaryUserId, false, null, ignoreOptions)
    } else {
      this.logService.logInfo(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was unmodded, but internal mod rank is not active. Ignoring.`)
    }
  }

  public async onYoutubeChannelBanned (streamerId: number, channelName: string, moderatorChannelName: string) {
    const data = await this.externalRankDataService.getYoutubeDataForExternalRankEvent(streamerId, channelName, moderatorChannelName, 'punishment')
    if (data == null) {
      // this doesn't work for channelName "Chat Mate Test1" - investigate
      this.logService.logWarning(this, `Received notification that Youtube channel ${channelName} for streamer ${streamerId} was banned, but could not find channel or found multiple channels. Ignoring.`)
      return
    }

    const { primaryUserId, channelId, ranksForUser, moderatorPrimaryUserId } = data
    const ignoreOptions: IgnoreOptions = { youtubeChannelId: channelId }

    if (ranksForUser.find(r => r.rank.name === 'ban') == null) {
      this.logService.logInfo(this, `Received notification that Youtube channel ${channelName} for streamer ${streamerId} was banned. Syncing punishment.`)
      await this.punishmentService.banUser(primaryUserId, streamerId, moderatorPrimaryUserId, null, ignoreOptions)
    } else {
      this.logService.logInfo(this, `Received notification that Youtube channel ${channelName} for streamer ${streamerId} was banned, but internal punishment is already active. Ignoring.`)
    }
  }

  public async onYoutubeChannelModded (streamerId: number, youtubeChannelId: number) {
    const youtubeChannel = await this.channelStore.getYoutubeChannelsFromChannelIds([youtubeChannelId]).then(single)
    if (youtubeChannel.aggregateUserId == null) {
      this.logService.logInfo(this, `Received notification that Youtube channel ${youtubeChannelId} for streamer ${streamerId} was modded, but channel has no other channels linked. Nothing to sync.`)
      return
    }

    const ranks = await this.rankStore.getUserRanksForGroup('administration', streamerId)

    if (ranks.find(r => r.rank.name === 'mod') == null) {
      this.logService.logInfo(this, `Received notification that Youtube channel ${youtubeChannelId} for streamer ${streamerId} was modded. Syncing mod rank.`)

      const ignoreOptions: IgnoreOptions = { youtubeChannelId }
      const streamer = await this.streamerStore.getStreamerById(streamerId)
      const streamerPrimaryUserId = await this.accountStore.getRegisteredUsersFromIds([streamer!.registeredUserId]).then(user => single(user).aggregateChatUserId)

      await this.modService.setModRank(youtubeChannel.aggregateUserId, streamerId, streamerPrimaryUserId, true, null, ignoreOptions)
    } else {
      this.logService.logInfo(this, `Received notification that Youtube channel ${youtubeChannelId} for streamer ${streamerId} was modded, but internal mod rank is already active. Ignoring.`)
    }
  }

  public async onYoutubeChannelUnbanned (streamerId: number, channelName: string, moderatorChannelName: string) {
    const data = await this.externalRankDataService.getYoutubeDataForExternalRankEvent(streamerId, channelName, moderatorChannelName, 'punishment')
    if (data == null) {
      this.logService.logWarning(this, `Received notification that Youtube channel ${channelName} for streamer ${streamerId} was unbanned, but could not find channel or found multiple channels. Ignoring.`)
      return
    }

    const { primaryUserId, channelId, ranksForUser, moderatorPrimaryUserId } = data
    const ignoreOptions: IgnoreOptions = { youtubeChannelId: channelId }

    if (ranksForUser.find(r => r.rank.name === 'ban') != null) {
      this.logService.logInfo(this, `Received notification that Youtube channel ${channelName} for streamer ${streamerId} was unbanned. Syncing punishment.`)
      await this.punishmentService.unbanUser(primaryUserId, streamerId, moderatorPrimaryUserId, null, ignoreOptions)
    } else {
      this.logService.logInfo(this, `Received notification that Youtube channel ${channelName} for streamer ${streamerId} was unbanned, but internal punishment is not active. Ignoring.`)
    }
  }

  public async onYoutubeChannelUnmodded (streamerId: number, youtubeChannelId: number) {
    const youtubeChannel = await this.channelStore.getYoutubeChannelsFromChannelIds([youtubeChannelId]).then(single)
    if (youtubeChannel.aggregateUserId == null) {
      this.logService.logInfo(this, `Received notification that Youtube channel ${youtubeChannelId} for streamer ${streamerId} was unmodded, but channel has no other channels linked. Nothing to sync.`)
      return
    }

    const ranks = await this.rankStore.getUserRanksForGroup('administration', streamerId)

    if (ranks.find(r => r.rank.name === 'mod') != null) {
      this.logService.logInfo(this, `Received notification that Youtube channel ${youtubeChannelId} for streamer ${streamerId} was unmodded. Syncing mod ran.`)

      const ignoreOptions: IgnoreOptions = { youtubeChannelId }
      const streamer = await this.streamerStore.getStreamerById(streamerId)
      const streamerPrimaryUserId = await this.accountStore.getRegisteredUsersFromIds([streamer!.registeredUserId]).then(user => single(user).aggregateChatUserId)

      await this.modService.setModRank(youtubeChannel.aggregateUserId, streamerId, streamerPrimaryUserId, false, null, ignoreOptions)
    } else {
      this.logService.logInfo(this, `Received notification that Youtube channel ${youtubeChannelId} for streamer ${streamerId} was unmodded, but internal mod rank is not active. Ignoring.`)
    }
  }

  public async onYoutubeChannelTimedOut (streamerId: number, channelName: string, moderatorChannelName: string, durationSeconds: number) {
    const data = await this.externalRankDataService.getYoutubeDataForExternalRankEvent(streamerId, channelName, moderatorChannelName, 'punishment')
    if (data == null) {
      this.logService.logWarning(this, `Received notification that Youtube channel ${channelName} for streamer ${streamerId} was timed out for ${durationSeconds} seconds, but could not find channel or found multiple channels. Ignoring.`)
      return
    }

    const { primaryUserId, channelId, ranksForUser, moderatorPrimaryUserId } = data
    const ignoreOptions: IgnoreOptions = { youtubeChannelId: channelId }

    if (ranksForUser.find(r => r.rank.name === 'timeout') == null) {
      this.logService.logInfo(this, `Received notification that Youtube channel ${channelName} for streamer ${streamerId} was timed out for ${durationSeconds} seconds. Syncing punishment.`)
      await this.punishmentService.timeoutUser(primaryUserId, streamerId, moderatorPrimaryUserId, null, durationSeconds, ignoreOptions)
    } else {
      this.logService.logInfo(this, `Received notification that Youtube channel ${channelName} for streamer ${streamerId} was timed out for ${durationSeconds} seconds, but internal punishment is already active. Ignoring.`)
    }
  }
}
