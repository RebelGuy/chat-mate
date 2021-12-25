import { Livestream } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { New } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'

type Deps = Dependencies<{
  liveId: string,
  dbProvider: DbProvider
}>

export default class LivestreamStore {
  private readonly liveId: string
  private readonly db: Db
  
  private _currentLivestream: Livestream | null = null
  public get currentLivestream() {
    if (this._currentLivestream) {
      return this._currentLivestream
    } else {
      throw new Error('Current livestream has not been created yet')
    }
  }

  constructor(deps: Deps) {
    this.liveId = deps.resolve('liveId')
    this.db = deps.resolve('dbProvider').get()
  }

  public async createLivestream (): Promise<Livestream> {
    return this.createOrUpdateLivestream({ createdAt: new Date(), liveId: this.liveId })
  }

  public async setContinuationToken (continuationToken: string | null): Promise<Livestream> {
    if (!this._currentLivestream) {
      throw new Error('No current livestream exists')
    } else {
      return this.createOrUpdateLivestream({ ...this._currentLivestream, continuationToken })
    }
  }

  private async createOrUpdateLivestream (livestream: New<Livestream>): Promise<Livestream> {
    this._currentLivestream = await this.db.livestream.upsert({ 
      create: { ...livestream },
      where: { liveId: livestream.liveId },
      update: { continuationToken: livestream.continuationToken }
    })

    return this._currentLivestream
  }
}
