import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import LogService from '@rebel/server/services/LogService'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'

type Deps = Dependencies<{
  logService: LogService
  streamerChannelService: StreamerChannelService
  punishmentService: PunishmentService
  dateTimeHelpers: DateTimeHelpers
}>

export default class ExternalRankEventService extends ContextClass {
  public readonly name = ExternalRankEventService.name

  private readonly logService: LogService
  private readonly streamerChannelService: StreamerChannelService
  private readonly punishmentService: PunishmentService
  private readonly dateTimeHelpers: DateTimeHelpers

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.streamerChannelService = deps.resolve('streamerChannelService')
    this.punishmentService = deps.resolve('punishmentService')
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
  }

  // for these methods, it is assumed that all internal and external ranks were in sync at the time when the external rank was changed

  public async onTwitchChannelBanned (streamerId: number, channelName: string, moderatorChannelName: string, reason: string, endTime: number | null): Promise<void> {
    const { primaryUserId, ranksForUser, moderatorPrimaryUserId } = await this.streamerChannelService.getDataForTwitchRankEvent(streamerId, channelName, moderatorChannelName)
    if (primaryUserId == null) {
      this.logService.logWarning(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was banned/timed out, but could not find channel. Ignoring.`)
      return
    }

    // if the user has other channels, it will cause this event to fire for those channels as well. since the first thing we do
    // when applying a punishment is create a ChatMate rank, we don't have to worry about infinite loops here.
    if (endTime == null && ranksForUser.find(r => r.rank.name === 'ban') == null) {
      await this.punishmentService.banUser(primaryUserId, streamerId, moderatorPrimaryUserId, reason)
    } else if (endTime != null && ranksForUser.find(r => r.rank.name === 'timeout') == null) {
      const durationSeconds = (endTime - this.dateTimeHelpers.ts()) / 1000
      if (durationSeconds > 0) {
        await this.punishmentService.timeoutUser(primaryUserId, streamerId, moderatorPrimaryUserId, reason, durationSeconds)
      } else {
        this.logService.logWarning(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was timed out, but internal punishment is already active. Ignoring.`)
      }
    } else {
      this.logService.logWarning(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was banned/timed out, but internal punishment is already active. Ignoring.`)
      return
    }
  }

  public async onTwitchChannelUnbanned (streamerId: number, channelName: string, moderatorChannelName: string): Promise<void> {
    const { primaryUserId, ranksForUser, moderatorPrimaryUserId } = await this.streamerChannelService.getDataForTwitchRankEvent(streamerId, channelName, moderatorChannelName)
    if (primaryUserId == null) {
      this.logService.logWarning(this, `Received notification that Twitch channel ${channelName} for streamer ${streamerId} was banned/timed out, but could not find channel. Ignoring.`)
      return
    }

    // I think technically this doesn't work consistently/cleanly if the user is both banned and timed out internally, but only timed out on Twitch. in that case, removing the
    // ban rank will remove the Twitch punishment, but trigger another unban event before the internal timeout rank was removed. This means one of the two event handlers may
    // very well fail, but I think it's not an issue considering the rarity of the situation
    if (ranksForUser.find(r => r.rank.name === 'ban') != null) {
      await this.punishmentService.unbanUser(primaryUserId, streamerId, moderatorPrimaryUserId, null)
    }
    if (ranksForUser.find(r => r.rank.name === 'timeout') != null) {
      await this.punishmentService.untimeoutUser(primaryUserId, streamerId, moderatorPrimaryUserId, null)
    }
  }
}
