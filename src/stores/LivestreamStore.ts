import { Livestream } from '@prisma/client'
import { Dependencies } from '@rebel/context/context'
import { New } from '@rebel/models/entities'
import DbProvider, { Db } from '@rebel/providers/DbProvider'

export default class LivestreamStore {
  private readonly liveId: string
  private readonly db: Db
  private readonly disableSaving: boolean
  
  private _currentLivestream: Livestream | null = null
  public get currentLivestream() {
    if (this._currentLivestream) {
      return this._currentLivestream
    } else {
      throw new Error('Current livestream has not been created yet')
    }
  }

  constructor(deps: Dependencies) {
    this.liveId = deps.resolve<string>('liveId')
    this.db = deps.resolve<DbProvider>(DbProvider.name).get()
    this.disableSaving = deps.resolve<boolean>('disableSaving')
  }

  public async createLivestream (): Promise<Livestream> {
    return this.createOrUpdateLivestream({ createdAt: new Date(), liveId: this.liveId })
  }

  public async setContinuationToken (continuationToken: string): Promise<Livestream> {
    if (!this._currentLivestream) {
      throw new Error('No current livestream exists')
    } else {
      return this.createOrUpdateLivestream({ ...this._currentLivestream, continuationToken })
    }
  }

  private async createOrUpdateLivestream (livestream: New<Livestream>): Promise<Livestream> {
    if (this.disableSaving) {
      this._currentLivestream = { ...livestream, continuationToken: livestream.continuationToken ?? null, id: 1 }
      return this._currentLivestream
    }

    this._currentLivestream = await this.db.livestream.upsert({ 
      create: { ...livestream },
      where: { liveId: livestream.liveId },
      update: { continuationToken: livestream.continuationToken }
    })

    return this._currentLivestream
  }
}
