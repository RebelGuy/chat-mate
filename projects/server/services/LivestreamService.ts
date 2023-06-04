import { Livestream } from '@prisma/client'
import { LiveStatus, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import LogService from '@rebel/server/services/LogService'
import MasterchatService from '@rebel/server/services/MasterchatService'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { addTime } from '@rebel/shared/util/datetime'
import { TwitchMetadata } from '@rebel/server/services/TwurpleService'

export const METADATA_SYNC_INTERVAL_MS = 12_000

type Deps = Dependencies<{
  livestreamStore: LivestreamStore
  masterchatService: MasterchatService
  twurpleApiProxyService: TwurpleApiProxyService
  logService: LogService
  timerHelpers: TimerHelpers
  disableExternalApis: boolean
  dateTimeHelpers: DateTimeHelpers
  streamerChannelService: StreamerChannelService
}>

export default class LivestreamService extends ContextClass {
  readonly name: string = LivestreamService.name

  private readonly livestreamStore: LivestreamStore
  private readonly masterchatService: MasterchatService
  private readonly twurpleApiProxyService: TwurpleApiProxyService
  private readonly logService: LogService
  private readonly timerHelpers: TimerHelpers
  private readonly disableExternalApis: boolean
  private readonly dateTimeHelpers: DateTimeHelpers
  private readonly streamerChannelService: StreamerChannelService

  constructor (deps: Deps) {
    super()
    this.livestreamStore = deps.resolve('livestreamStore')
    this.masterchatService = deps.resolve('masterchatService')
    this.twurpleApiProxyService = deps.resolve('twurpleApiProxyService')
    this.logService = deps.resolve('logService')
    this.timerHelpers = deps.resolve('timerHelpers')
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
    this.streamerChannelService = deps.resolve('streamerChannelService')
  }

  public override async initialise (): Promise<void> {
    if (this.disableExternalApis) {
      return
    }

    const activeLivestreams = await this.livestreamStore.getActiveLivestreams()
    activeLivestreams.forEach(l => this.masterchatService.addMasterchat(l.streamerId, l.liveId))

    const timerOptions: TimerOptions = {
      behaviour: 'start',
      callback: () => this.updateAllMetadata(),
      interval: METADATA_SYNC_INTERVAL_MS
    }
    await this.timerHelpers.createRepeatingTimer(timerOptions, true)
  }

  /** Sets the streamer's current livestream as inactive, also removing the associated masterchat instance. */
  public async deactivateLivestream (streamerId: number) {
    const activeLivestream = await this.livestreamStore.getActiveLivestream(streamerId)
    if (activeLivestream == null) {
      return
    }

    await this.livestreamStore.deactivateLivestream(streamerId)
    this.masterchatService.removeMasterchat(streamerId)
    this.logService.logInfo(this, `Livestream with id ${activeLivestream.liveId} for streamer ${streamerId} has been deactivated.`)
  }

  /** Sets the given livestream as active for the streamer, and creates a masterchat instance.
   * Please ensure you deactivate the previous livestream first, if applicable.
   * Attempts of activating a livestream that is from a different channel than the streamer's primary channel will throw. */
  public async setActiveLivestream (streamerId: number, liveId: string) {
    const streamerYoutubeChannelId = await this.streamerChannelService.getYoutubeExternalId(streamerId)
    if (streamerYoutubeChannelId == null) {
      throw new Error('No primary YouTube channel has been set for the streamer.')
    }

    const livestreamYoutubeChannelId = await this.masterchatService.getChannelIdFromAnyLiveId(liveId)
    if (streamerYoutubeChannelId !== livestreamYoutubeChannelId) {
      throw new Error(`The livestream does not belong to the streamer's primary YouTube channel.`)
    }

    await this.livestreamStore.setActiveLivestream(streamerId, liveId)
    this.masterchatService.addMasterchat(streamerId, liveId)
    this.logService.logInfo(this, `Livestream with id ${liveId} for streamer ${streamerId} has been activated.`)
  }

  private async fetchYoutubeMetadata (streamerId: number): Promise<Metadata | null> {
    try {
      return await this.masterchatService.fetchMetadata(streamerId)
    } catch (e: any) {
      this.logService.logWarning(this, 'Encountered error while fetching youtube metadata.', e.message)
      return null
    }
  }

  private async fetchTwitchMetadata (streamerId: number): Promise<TwitchMetadata | null> {
    try {
      const channelName = await this.streamerChannelService.getTwitchChannelName(streamerId)
      if (channelName == null) {
        return null
      }

      return await this.twurpleApiProxyService.fetchMetadata(channelName)
    } catch (e: any) {
      this.logService.logWarning(this, 'Encountered error while fetching twitch metadata.', e.message)
      return null
    }
  }

  private async updateAllMetadata () {
    const activeLivestreams = await this.livestreamStore.getActiveLivestreams()
    await Promise.all(activeLivestreams.map(l => this.updateLivestreamMetadata(l)))
  }

  private async updateLivestreamMetadata (livestream: Livestream) {
    if (livestream.end != null && this.dateTimeHelpers.now() > addTime(livestream.end, 'minutes', 2)) {
      // automatically deactivate public livestream after stream has ended - fetching chat will error out anyway
      // (after some delay), so there is no need to keep it around.
      this.logService.logInfo(this, `Automatically deactivating current livestream with id ${livestream.liveId} for streamer ${livestream.streamerId} because it has ended.`)
      await this.deactivateLivestream(livestream.streamerId)
      return
    }

    const youtubeMetadata = await this.fetchYoutubeMetadata(livestream.streamerId)
    const twitchMetadata = await this.fetchTwitchMetadata(livestream.streamerId)

    // deliberately require that youtube metadata is always called successfully, as it
    // is used as the source of truth for the stream status
    if (youtubeMetadata == null) {
      return
    }

    try {
      const updatedTimes = this.getUpdatedLivestreamTimes(livestream, youtubeMetadata)

      if (updatedTimes) {
        await this.livestreamStore.setTimes(livestream.liveId, updatedTimes)
      }

      if (youtubeMetadata.liveStatus === 'live' && youtubeMetadata.viewerCount != null) {
        await this.livestreamStore.addLiveViewCount(livestream.id, youtubeMetadata.viewerCount, twitchMetadata?.viewerCount ?? 0)
      }
    } catch (e: any) {
      this.logService.logError(this, `Encountered error while syncing metadata for livestream ${livestream.liveId}.`, e)
    }
  }

  private getUpdatedLivestreamTimes (existingLivestream: Livestream, metadata: Metadata): Pick<Livestream, 'start' | 'end'> | null {
    const newStatus = metadata.liveStatus
    if (newStatus === 'unknown') {
      this.logService.logWarning(this, `Tried to update livestream times, but current live status was reported as 'unkown'. Won't attempt to update livestream times.`)
      return null
    }

    const existingStatus = LivestreamService.getLivestreamStatus(existingLivestream)
    if (existingStatus === 'finished' && newStatus !== 'finished' || existingStatus === 'live' && newStatus === 'not_started') {
      // invalid status
      throw new Error(`Unable to update livestream times because current status '${existingStatus}' is incompatible with new status '${newStatus}'.`)
    } else if (existingStatus === newStatus) {
      return null
    } else if (existingStatus === 'not_started' && newStatus === 'live') {
      // just started
      this.logService.logInfo(this, 'Livestream has started')
      return {
        start: new Date(),
        end: existingLivestream.end
      }
    } else if (existingStatus === 'not_started' && newStatus === 'finished') {
      // should not happen, but not impossible
      this.logService.logWarning(this, 'Livestream has finished before it started - 0 duration')
      return {
        start: new Date(),
        end: new Date()
      }
    } else if (existingStatus === 'live' && newStatus === 'finished') {
      // just finished
      this.logService.logInfo(this, 'Livestream has finished')
      return {
        start: existingLivestream.start,
        end: new Date()
      }
    } else {
      throw new Error('Did not expect to get here')
    }
  }

  private static getLivestreamStatus (livestream: Livestream): Exclude<LiveStatus, 'unknown'> {
    if (livestream.start == null && livestream.end == null) {
      return 'not_started'
    } else if (livestream.start != null && livestream.end == null) {
      return 'live'
    } else if (livestream.start != null && livestream.end != null && livestream.start < livestream.end) {
      return 'finished'
    } else {
      throw new Error(`Could not determine livestream status based on start time ${livestream.start} and end time ${livestream.end}`)
    }
  }
}
