import Factory from '@rebel/shared/Factory'
import { AppTokenAuthProvider } from '@twurple/auth'

export default class AppTokenAuthProviderFactory extends Factory<typeof AppTokenAuthProvider> {
  constructor () {
    super(AppTokenAuthProvider)
  }
}
