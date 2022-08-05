import { ChatUser } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import RankStore from '@rebel/server/stores/RankStore'

type Deps = Dependencies<{
  rankStore: RankStore
}>

export default class AdminService extends ContextClass {
  private readonly rankStore: RankStore

  constructor (deps: Deps) {
    super()

    this.rankStore = deps.resolve('rankStore')
  }

  /** Returns all current system admin users. */
  public async getAdminUsers (): Promise<ChatUser[]> {
    const allRanks = await this.rankStore.getUserRanksForGroup('administration')
    return allRanks.filter(r => r.rank.name === 'admin').map(r => ({ id: r.userId }))
  }
}
