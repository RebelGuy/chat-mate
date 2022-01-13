import { Livestream } from '@prisma/client'
import { LiveStatus, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import { IMasterchat } from '@rebel/server/interfaces'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'

export const METADATA_SYNC_INTERVAL_MS = 12_000

type Deps = Dependencies<{
  livestreamStore: LivestreamStore
  masterchatProvider: MasterchatProvider,
  logService: LogService
}>

export default class LivestreamService {
  readonly name: string = LivestreamService.name

  private readonly livestreamStore: LivestreamStore
  private readonly masterchat: IMasterchat
  private readonly logService: LogService

  private syncTimer: NodeJS.Timer | null = null

  constructor (deps: Deps) {
    this.livestreamStore = deps.resolve('livestreamStore')
    this.masterchat = deps.resolve('masterchatProvider').get()
    this.logService = deps.resolve('logService')
  }

  public async start () {
    await this.updateLivestreamMetadata()

    // IMPORTANT: notice that we are passing a sync function to setInterval - do not change this,
    // otherwise fake timer tests break with no clear error message
    this.syncTimer = setInterval(() => this.updateLivestreamMetadata(), METADATA_SYNC_INTERVAL_MS)
  }

  public dispose () {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  private async updateLivestreamMetadata () {
    try {
      this.logService.logDebug(this, 'Syncing metadata')
      const metadata = await this.masterchat.fetchMetadata()
      const updatedTimes = this.getUpdatedLivestreamTimes(this.livestreamStore.currentLivestream, metadata)

      if (updatedTimes) {
        this.livestreamStore.setTimes(updatedTimes)
      }
    } catch (e) {
      this.logService.logWarning(this, 'Encountered error while syncing metadata:', e)
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
