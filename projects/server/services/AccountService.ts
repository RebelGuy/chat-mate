import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import AccountStore from '@rebel/server/stores/AccountStore'

type Deps = Dependencies<{
  accountStore: AccountStore
}>

export default class AccountService extends ContextClass {
  private readonly accountStore: AccountStore

  constructor (deps: Deps) {
    super()
    this.accountStore = deps.resolve('accountStore')
  }
}
