import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'

const MAX_DATA_LENGTH = 4096 // set in the schema.prisma file

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class MasterchatStore extends ContextClass {
  readonly name: string = MasterchatStore.name

  private readonly db: Db

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
  }

  public async addMasterchatAction (type: string, serialisedData: string, time: number | null, liveId: string) {
    await this.db.masterchatAction.create({ data: {
      type: type,
      data: serialisedData.substring(0, MAX_DATA_LENGTH),
      time: time != null ? new Date(time) : null,
      youtubeLivestream: { connect: { liveId: liveId }}
    }})
  }

  public async hasActionWithTime (type: string, time: number, liveId: string) {
    const result = await this.db.masterchatAction.findFirst({ where: {
      type: type,
      youtubeLivestream: { liveId: liveId },
      time: new Date(time)
    }})

    return result != null
  }
}
