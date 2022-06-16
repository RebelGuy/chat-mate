import { Livestream, LivestreamType } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import LogService from '@rebel/server/services/LogService'
import { reminder } from '@rebel/server/util/typescript'

type Deps = Dependencies<{
  dbProvider: DbProvider,
  logService: LogService
}>

export default class LivestreamStore extends ContextClass {
  readonly name: string = LivestreamStore.name

  private readonly db: Db
  private readonly logService: LogService

  private _activeLivestream!: Livestream | null
  /** Gets the public *livestream* that is currently active. */
  public get activeLivestream (): Livestream | null { return this._activeLivestream } // please remind me why we are using a getter here?

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
    this.logService = deps.resolve('logService')
  }

  public override async initialise () {
    const maybeLivestream = await this.db.livestream.findFirst({ where: { isActive: true, type: 'publicLivestream' }})
    this._activeLivestream = maybeLivestream ?? null
  }

  /** Sets the current active livestream to inactive such that `LivestreamStore.activeLivestream` returns null. */
  public async deactivateLivestream (): Promise<void> {
    if (this.activeLivestream == null) {
      return
    }

    await this.db.livestream.update({
      where: { liveId: this.activeLivestream!.liveId },
      data: { isActive: false }
    })

    this._activeLivestream = null
  }

  // todo: in the future, we can pass more options into this function, e.g. if a livestream is considered unlisted
  /** Sets the given livestream as active, such that `LivestreamStore.activeLivestream` returns this stream.
   * Please ensure you deactivate the previous livestream first, if applicable. */
  public async setActiveLivestream (liveId: string, type: LivestreamType): Promise<Livestream> {
    if (this._activeLivestream != null) {
      if (this._activeLivestream.liveId === liveId) {
        return this._activeLivestream
      } else {
        throw new Error('Cannot set an active livestream while another livestream is already active. Please ensure you deactivate the existing livestream first.')
      }
    }

    return this.updateCachedLivestream(
      await this.db.livestream.upsert({
        create: { liveId, createdAt: new Date(), isActive: true, type },
        update: { isActive: true },
        where: { liveId }
      })
    )
  }

  public async setContinuationToken (liveId: string, continuationToken: string | null): Promise<Livestream> {
    return this.updateCachedLivestream(
      await this.db.livestream.update({
        where: { liveId },
        data: { continuationToken }
      })
    )
  }

  public async setTimes (liveId: string, updatedTimes: Pick<Livestream, 'start' | 'end'>): Promise<Livestream> {
    return this.updateCachedLivestream(
      await this.db.livestream.update({
        where: { liveId },
        data: { ...updatedTimes }
      })
    )
  }

  private updateCachedLivestream (livestream: Livestream) {
    if (this._activeLivestream != null && this._activeLivestream.liveId !== livestream.liveId) {
      // for the new type (probably "unlistedLivestream"), we will need to add a new cached livestream
      reminder<LivestreamType>({ publicLivestream: true })

      throw new Error('Cannot update cached livestream because the liveIds do not match. This suggests there are two active livestreams. Before adding an active livestream, ensure that the previous one has been deactivated.')
    }

    this._activeLivestream = livestream
    return this._activeLivestream = livestream
  }
}
