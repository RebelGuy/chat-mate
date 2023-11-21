import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'

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

  public async addApiRequest (streamerId: number, request: string, cost: number, success: boolean) {
    await this.db.youtubeApiRequest.create({ data: { streamerId, request, cost, success }})
  }
}
