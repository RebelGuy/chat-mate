import Factory from '@rebel/shared/Factory'
import { RefreshingAuthProvider } from '@twurple/auth'

export default class RefreshingAuthProviderFactory extends Factory<typeof RefreshingAuthProvider> {
  constructor () {
    super(RefreshingAuthProvider)
  }
}
