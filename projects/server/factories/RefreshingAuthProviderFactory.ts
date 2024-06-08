import ContextClass from '@rebel/shared/context/ContextClass'
import { RefreshingAuthProviderConfig, RefreshingAuthProvider } from '@twurple/auth'

export default class RefreshingAuthProviderFactory extends ContextClass {
  public create (refreshConfig: RefreshingAuthProviderConfig) {
    return new RefreshingAuthProvider(refreshConfig)
  }
}
