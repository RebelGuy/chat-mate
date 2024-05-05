import { TwitchFollower } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import LogService from '@rebel/server/services/LogService'

type Deps = Dependencies<{
  logService: LogService
  dbProvider: DbProvider
}>

export default class FollowerStore extends ContextClass {
  public readonly name = FollowerStore.name

  private readonly logService: LogService
  private readonly db: Db
  constructor (deps: Deps) {
    super()

    this.logService = deps.resolve('logService')
    this.db = deps.resolve('dbProvider').get()
  }

  public async getFollower (streamerId: number, twitchUserId: string): Promise<TwitchFollower | null> {
    return await this.db.twitchFollower.findUnique({
      where: { streamerId_twitchUserId: { streamerId, twitchUserId }}
    })
  }

  /** Returns the followers since the given timestamp (exclusive). */
  public async getFollowersSince (streamerId: number, since: number): Promise<TwitchFollower[]> {
    try {
      return await this.db.twitchFollower.findMany({ where: {
        streamerId: streamerId,
        date: { gt: new Date(since) }
      }})
    } catch (e) {
      this.logService.logError(this, 'Unable to get followers since', since, e)
      return []
    }
  }

  /** Saves the user's details to the TwitchFollowers table if they follow for the first time. */
  public async saveNewFollower (streamerId: number, twitchUserId: string, userName: string, userDisplayName: string) {
    try {
      await this.db.twitchFollower.create({
        data: {
          streamerId: streamerId,
          twitchUserId: twitchUserId,
          userName: userName,
          displayName: userDisplayName
        }
      })
    } catch (e) {
      // this is a non-critical class, can just ignore the error
      this.logService.logError(this, 'Unable to save new follower', streamerId, userName, e)
    }
  }
}
