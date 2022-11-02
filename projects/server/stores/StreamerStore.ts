import { Streamer } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class StreamerStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()

    this.db = deps.resolve('dbProvider').get()
  }

  public async getStreamerByName (username: string): Promise<Streamer | null> {
    return await this.db.streamer.findFirst({
      where: { registeredUser: { username }}
    })
  }
}
