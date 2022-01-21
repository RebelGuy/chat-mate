import { Livestream } from '@prisma/client'
import { LiveStatus, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import { IMasterchat } from '@rebel/server/interfaces'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'

export const METADATA_SYNC_INTERVAL_MS = 12_000

type Deps = Dependencies<{
  livestreamStore: LivestreamStore
  masterchatProvider: MasterchatProvider,
  logService: LogService,
  timerHelpers: TimerHelpers,
  viewershipStore: ViewershipStore
}>

export default class LivestreamService {
  readonly name: string = LivestreamService.name

  private readonly livestreamStore: LivestreamStore
  private readonly masterchat: IMasterchat
  private readonly logService: LogService
  private readonly timerHelpers: TimerHelpers
  private readonly viewershipStore: ViewershipStore

  constructor (deps: Deps) {
    this.livestreamStore = deps.resolve('livestreamStore')
    this.masterchat = deps.resolve('masterchatProvider').get()
    this.logService = deps.resolve('logService')
    this.timerHelpers = deps.resolve('timerHelpers')
    this.viewershipStore = deps.resolve('viewershipStore')
  }

  public async start (): Promise<void> {
    const timerOptions: TimerOptions = {
      behaviour: 'start',
      callback: () => this.updateLivestreamMetadata(),
      interval: METADATA_SYNC_INTERVAL_MS
    }
    await this.timerHelpers.createRepeatingTimer(timerOptions, true)
  }

  private async updateLivestreamMetadata () {
    try {
      const metadata = await this.masterchat.fetchMetadata()
      const updatedTimes = this.getUpdatedLivestreamTimes(this.livestreamStore.currentLivestream, metadata)

      if (updatedTimes) {
        await this.livestreamStore.setTimes(updatedTimes)
      }

      if (metadata.liveStatus === 'live' && metadata.viewerCount != null) {
        await this.viewershipStore.addLiveViewCount(metadata.viewerCount)
      }
    } catch (e: any) {
      this.logService.logWarning(this, 'Encountered error while syncing metadata:', e.message)
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
