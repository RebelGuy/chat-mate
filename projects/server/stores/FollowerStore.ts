import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
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

  /** Saves the user's details to the TwitchFollowers table if they follow for the first time. */
  public async saveNewFollower (userId: string, userName: string, userDisplayName: string) {
    try {
      await this.db.twitchFollower.upsert({
        create: { twitchId: userId, userName: userName, displayName: userDisplayName },
        update: {},
        where: { twitchId: userId }
      })
    } catch (e) {
      // this is a non-critical class, can just ignore the error
      this.logService.logError(this, 'Unable to save new follower', userName, e)
    }
  }
}
