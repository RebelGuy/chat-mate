import ContextClass from '@rebel/shared/context/ContextClass'
import { StaticAuthProvider, AccessToken } from '@twurple/auth'

export default class StaticAuthProviderFactory extends ContextClass {
  public create (clientId: string, accessToken: string | AccessToken, scopes?: string[]) {
    return new StaticAuthProvider(clientId, accessToken, scopes)
  }
}
