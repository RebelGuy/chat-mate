import Factory from '@rebel/server/factories/Factory'
import { ClientCredentialsAuthProvider } from '@twurple/auth'

export default class ClientCredentialsAuthProviderFactory extends Factory<typeof ClientCredentialsAuthProvider> {
  constructor () {
    super(ClientCredentialsAuthProvider)
  }
}
