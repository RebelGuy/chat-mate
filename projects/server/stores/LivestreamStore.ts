import { Livestream } from '@prisma/client'
import { Metadata } from '@rebel/masterchat'
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
        start: metadata.isLive ? new Date() : null,
        end: null
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
    this.logService.logDebug(this, 'Syncing metadata')
    const metadata = await this.masterchat.fetchMetadata()

    const updatedTimes = this.getUpdatedLivestreamTimes(this._currentLivestream!, metadata)
    return this._currentLivestream = await this.db.livestream.update({
      where: { liveId: this.liveId },
      data: { ...updatedTimes }
    })
  }

  private getUpdatedLivestreamTimes (existingLivestream: Livestream, metadata: Metadata): Pick<Livestream, 'start' | 'end'> {
    const isLive = metadata.isLive
    const existingStatus = LivestreamStore.getLivestreamStatus(existingLivestream)
      if (existingStatus === 'finished' && isLive) {
        // invalid status
        throw new Error('Unable to create livestream because it is finished, but masterchat claims it is ongoing.')
      } else if ((existingStatus === 'not_started' || existingStatus === 'finished') && !isLive || existingStatus === 'live' && isLive) {
        // status has not changed
        return {
          start: existingLivestream.start,
          end: existingLivestream.end
        }
      } else if (existingStatus === 'not_started' && isLive) {
        // just started
        this.logService.logInfo(this, 'Livestream has started')
        return {
          start: new Date(),
          end: existingLivestream.end
        }
      } else if (existingStatus === 'live' && !isLive) {
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

  private static getLivestreamStatus (livestream: Livestream): 'not_started' | 'live' | 'finished' {
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
