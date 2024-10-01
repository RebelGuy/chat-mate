import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class UserStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()

    this.db = deps.resolve('dbProvider').get()
  }

  public async setDisplayName (registeredUserId: number, displayName: string | null) {
    await this.db.registeredUser.update({
      where: { id: registeredUserId },
      data: { displayName: displayName }
    })
  }
}
