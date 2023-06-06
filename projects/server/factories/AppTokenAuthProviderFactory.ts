import ContextClass from '@rebel/shared/context/ContextClass'
import { AppTokenAuthProvider } from '@twurple/auth'

export default class AppTokenAuthProviderFactory extends ContextClass {
  public create (clientId: string, clientSecret: string, impliedScopes?: string[] | undefined) {
    return new AppTokenAuthProvider(clientId, clientSecret, impliedScopes)
  }
}
