import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import LinkStore from '@rebel/server/stores/LinkStore'

type Deps = Dependencies<{
  linkStore: LinkStore
}>

export default class UserService extends ContextClass {
  private readonly linkStore: LinkStore

  constructor (deps: Deps) {
    super()
    this.linkStore = deps.resolve('linkStore')
  }

  public async isUserBusy (anyUserId: number): Promise<boolean> {
    return await this.linkStore.isLinkInProgress(anyUserId)
  }
}
