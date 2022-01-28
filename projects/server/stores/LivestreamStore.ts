import { Livestream } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import LogService from '@rebel/server/services/LogService'

type Deps = Dependencies<{
  liveId: string,
  dbProvider: DbProvider,
  logService: LogService
}>

export default class LivestreamStore {
  readonly name: string = LivestreamStore.name

  private readonly liveId: string
  private readonly db: Db
  private readonly logService: LogService

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
    this.logService = deps.resolve('logService')
  }

  public async createLivestream (): Promise<Livestream> {
    const existingLivestream = await this.db.livestream.findUnique({ where: { liveId: this.liveId }})

    if (!existingLivestream) {
      this._currentLivestream = await this.db.livestream.create({ data: {
        createdAt: new Date(),
        liveId: this.liveId
      }})
    } else {
      this._currentLivestream = existingLivestream
    }

    return this._currentLivestream
  }

  public async setContinuationToken (continuationToken: string | null): Promise<Livestream> {
    if (!this._currentLivestream) {
      throw new Error('No current livestream exists')
    }

    return this._currentLivestream = await this.db.livestream.update({
      where: { liveId: this._currentLivestream.liveId! },
      data: { ...this._currentLivestream, continuationToken }
    })
  }

  public async setTimes (updatedTimes: Pick<Livestream, 'start' | 'end'>): Promise<Livestream> {
    if (!this._currentLivestream) {
      throw new Error('No current livestream exists')
    }

    return this._currentLivestream = await this.db.livestream.update({
      where: { liveId: this.liveId },
      data: { ...updatedTimes }
    })
  }
}
