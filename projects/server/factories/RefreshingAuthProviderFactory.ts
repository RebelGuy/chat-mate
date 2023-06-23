import ContextClass from '@rebel/shared/context/ContextClass'
import { RefreshConfig, RefreshingAuthProvider } from '@twurple/auth'

export default class RefreshingAuthProviderFactory extends ContextClass {
  public create (refreshConfig: RefreshConfig) {
    return new RefreshingAuthProvider(refreshConfig)
  }
}
