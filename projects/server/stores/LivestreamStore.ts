import { Livestream } from '@prisma/client'
import { LiveStatus, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import { IMasterchat } from '@rebel/server/interfaces'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import LogService from '@rebel/server/services/LogService'

export const METADATA_SYNC_INTERVAL_MS = 60_000

type Deps = Dependencies<{
  liveId: string,
  dbProvider: DbProvider,
  masterchatProvider: MasterchatProvider,
  logService: LogService
}>

export default class LivestreamStore {
  readonly name: string = LivestreamStore.name

  private readonly liveId: string
  private readonly db: Db
  private readonly masterchat: IMasterchat
  private readonly logService: LogService

  private syncTimer: NodeJS.Timer | null = null

  private _currentLivestream: Livestream | null = null
  public get currentLivestream () {
    if (this._currentLivestream) {
      return this._currentLivestream
    } else {
      throw new Error('Current livestream has not been created yet')
    }
  }

  constructor (deps: Deps) {
    this.liveId = deps.resolve('liveId')
    this.db = deps.resolve('dbProvider').get()
    this.masterchat = deps.resolve('masterchatProvider').get()
    this.logService = deps.resolve('logService')
  }

  public async createLivestream (): Promise<Livestream> {
    const existingLivestreamPromise = this.db.livestream.findUnique({ where: { liveId: this.liveId }})
    const metadata = await this.masterchat.fetchMetadata()
    const existingLivestream = await existingLivestreamPromise

    this.syncTimer = setInterval(() => this.updateLivestreamMetadata(), METADATA_SYNC_INTERVAL_MS)

    let updatedLivestreamPromise
    if (existingLivestream) {
      const updatedTimes = this.getUpdatedLivestreamTimes(existingLivestream, metadata)
      updatedLivestreamPromise = this.db.livestream.update({
        where: { liveId: this.liveId },
        data: { ...updatedTimes }
      })
    } else {
      updatedLivestreamPromise = this.db.livestream.create({ data: {
        createdAt: new Date(),
        liveId: this.liveId,
        start: metadata.liveStatus === 'not_started' ? null : new Date(),
        end: metadata.liveStatus === 'finished' ? new Date() : null
      }})
    }

    return this._currentLivestream = await updatedLivestreamPromise
  }

  public async update (continuationToken: string | null): Promise<Livestream> {
    if (!this._currentLivestream) {
      throw new Error('No current livestream exists')
    }

    return this._currentLivestream = await this.db.livestream.update({
      where: { liveId: this._currentLivestream.liveId! },
      data: { ...this._currentLivestream, continuationToken }
    })
  }

  public dispose () {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }
  }

  private async updateLivestreamMetadata () {
    try {
      this.logService.logDebug(this, 'Syncing metadata')
      const metadata = await this.masterchat.fetchMetadata()

      const updatedTimes = this.getUpdatedLivestreamTimes(this._currentLivestream!, metadata)
      this._currentLivestream = await this.db.livestream.update({
        where: { liveId: this.liveId },
        data: { ...updatedTimes }
      })
    } catch (e) {
      this.logService.logWarning(this, 'Encountered error while syncing metadata:', e)
    }
  }

  private getUpdatedLivestreamTimes (existingLivestream: Livestream, metadata: Metadata): Pick<Livestream, 'start' | 'end'> {
    const newStatus = metadata.liveStatus
    if (newStatus === 'unknown') {
      this.logService.logWarning(this, `Tried to update livestream times, but current live status was reported as 'unkown'. Won't attempt to update livestream times.`)
      return {
        start: existingLivestream.start,
        end: existingLivestream.end
      }
    }

    const existingStatus = LivestreamStore.getLivestreamStatus(existingLivestream)
      if (existingStatus === 'finished' && newStatus !== 'finished' || existingStatus === 'live' && newStatus === 'not_started') {
        // invalid status
        throw new Error(`Unable to update livestream times because current status '${existingStatus}' is incompatible with new status '${newStatus}'.`)
      } else if (existingStatus === newStatus) {
        return {
          start: existingLivestream.start,
          end: existingLivestream.end
        }
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
