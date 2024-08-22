import { Image } from '@prisma/client'
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

  /** Returns null if no image with the given fingerprint exists. */
  public async getImageByFingerprint (fingerprint: string): Promise<Image | null> {
    return await this.db.image.findUnique({ where: { fingerprint: fingerprint }})
  }
}
