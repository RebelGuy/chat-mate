import Factory from '@rebel/shared/Factory'
import { ClientCredentialsAuthProvider } from '@twurple/auth'

export default class ClientCredentialsAuthProviderFactory extends Factory<typeof ClientCredentialsAuthProvider> {
  constructor () {
    super(ClientCredentialsAuthProvider)
  }
}
