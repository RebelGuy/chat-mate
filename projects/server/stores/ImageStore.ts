import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class ImageStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()

    this.db = deps.resolve('dbProvider').get()
  }

  public async hasImage (fingerprint: string): Promise<boolean> {
    const result = await this.db.image.findUnique({ where: { fingerprint: fingerprint }})
    return result != null
  }
}
