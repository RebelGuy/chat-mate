import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import IProvider from '@rebel/server/providers/IProvider'
import { ClientCredentialsAuthProvider } from '@twurple/auth/lib'

type Deps = Dependencies<{
  twitchClientId: string
  twitchClientSecret: string
}>

export default class TwurpleAuthProvider extends ContextClass implements IProvider<ClientCredentialsAuthProvider> {
  private readonly auth: ClientCredentialsAuthProvider

  constructor (deps: Deps) {
    super()
    this.auth = new ClientCredentialsAuthProvider(deps.resolve('twitchClientId'), deps.resolve('twitchClientSecret'))
  }

  get () {
    return this.auth
  }
}
