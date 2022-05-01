import { Livestream } from '@prisma/client'
import { LiveStatus, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import { IMasterchat, ITwurpleApi, TwitchMetadata } from '@rebel/server/interfaces'
import LogService from '@rebel/server/services/LogService'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'

export const METADATA_SYNC_INTERVAL_MS = 12_000

type Deps = Dependencies<{
  livestreamStore: LivestreamStore
  masterchatProxyService: MasterchatProxyService
  twurpleApiProxyService: TwurpleApiProxyService
  logService: LogService
  timerHelpers: TimerHelpers
  viewershipStore: ViewershipStore
  disableExternalApis: boolean
}>

export default class LivestreamService extends ContextClass {
  readonly name: string = LivestreamService.name

  private readonly livestreamStore: LivestreamStore
  private readonly masterchatProxyService: MasterchatProxyService
  private readonly twurpleApiProxyService: ITwurpleApi
  private readonly logService: LogService
  private readonly timerHelpers: TimerHelpers
  private readonly viewershipStore: ViewershipStore
  private readonly disableExternalApis: boolean

  constructor (deps: Deps) {
    super()
    this.livestreamStore = deps.resolve('livestreamStore')
    this.masterchatProxyService = deps.resolve('masterchatProxyService')
    this.twurpleApiProxyService = deps.resolve('twurpleApiProxyService')
    this.logService = deps.resolve('logService')
    this.timerHelpers = deps.resolve('timerHelpers')
    this.viewershipStore = deps.resolve('viewershipStore')
    this.disableExternalApis = deps.resolve('disableExternalApis')
  }

  public override async initialise (): Promise<void> {
    if (this.disableExternalApis) {
      return
    }

    if (this.livestreamStore.activeLivestream != null) {
      this.masterchatProxyService.addMasterchat(this.livestreamStore.activeLivestream.liveId)
    }

    const timerOptions: TimerOptions = {
      behaviour: 'start',
      callback: () => this.updateLivestreamMetadata(),
      interval: METADATA_SYNC_INTERVAL_MS
    }
    await this.timerHelpers.createRepeatingTimer(timerOptions, true)
  }

  /** Sets the current livestream as inactive, also removing the associated masterchat instance. */
  public async deactivateLivestream () {
    if (this.livestreamStore.activeLivestream == null) {
      return
    }

    const liveId = this.livestreamStore.activeLivestream.liveId
    await this.livestreamStore.deactivateLivestream()
    this.masterchatProxyService.removeMasterchat(liveId)
  }

  /** Sets the given livestream as active, and creates a masterchat instance.
   * Please ensure you deactivate the previous livestream first, if applicable. */
  public async setActiveLivestream (liveId: string) {
    await this.livestreamStore.setActiveLivestream(liveId, 'publicLivestream')
    this.masterchatProxyService.addMasterchat(liveId)
  }

  private async fetchYoutubeMetadata (liveId: string): Promise<Metadata | null> {
    try {
      return await this.masterchatProxyService.fetchMetadata(liveId)
    } catch (e: any) {
      this.logService.logWarning(this, 'Encountered error while fetching youtube metadata.', e.message)
      return null
    }
  }

  private async fetchTwitchMetadata (): Promise<TwitchMetadata | null> {
    try {
      return await this.twurpleApiProxyService.fetchMetadata()
    } catch (e: any) {
      this.logService.logWarning(this, 'Encountered error while fetching twitch metadata.', e.message)
      return null
    }
  }

  private async updateLivestreamMetadata () {
    const activeLivestream = this.livestreamStore.activeLivestream
    if (activeLivestream == null) {
      return
    }

    // deliberately require that youtube metadata is always called successfully, as it
    // is used as the source of truth for the stream status
    const youtubeMetadata = await this.fetchYoutubeMetadata(activeLivestream.liveId)
    if (youtubeMetadata == null) {
      return
    }

    const twitchMetadata = await this.fetchTwitchMetadata()

    try {
      const updatedTimes = this.getUpdatedLivestreamTimes(activeLivestream, youtubeMetadata)

      if (updatedTimes) {
        await this.livestreamStore.setTimes(activeLivestream.liveId, updatedTimes)
      }

      if (youtubeMetadata.liveStatus === 'live' && youtubeMetadata.viewerCount != null) {
        await this.viewershipStore.addLiveViewCount(youtubeMetadata.viewerCount, twitchMetadata?.viewerCount ?? 0)
      }
    } catch (e: any) {
      this.logService.logError(this, 'Encountered error while syncing metadata.', e)
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
