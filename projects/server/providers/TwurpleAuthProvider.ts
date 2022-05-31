import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import ClientCredentialsAuthProviderFactory from '@rebel/server/factories/ClientCredentialsAuthProviderFactory'
import RefreshingAuthProviderFactory from '@rebel/server/factories/RefreshingAuthProviderFactory'
import LogService from '@rebel/server/services/LogService'
import AuthStore from '@rebel/server/stores/AuthStore'
import { compareArrays } from '@rebel/server/util/arrays'
import { AccessToken, ClientCredentialsAuthProvider, RefreshingAuthProvider } from '@twurple/auth'

// see https://dev.twitch.tv/docs/authentication/scopes
// if you edit the scope here, you must request a new access token via `yarn auth:twitch:<env>`, set it in the .env file, and delete the saved token from the `twitch_auth` table.
export const TWITCH_SCOPE = ['chat:read', 'chat:edit', 'moderation:read', 'moderator:manage:banned_users', 'channel:moderate']

type Deps = Dependencies<{
  disableExternalApis: boolean
  isLive: boolean
  twitchClientId: string
  twitchClientSecret: string
  twitchAccessToken: string | null
  twitchRefreshToken: string | null
  logService: LogService
  authStore: AuthStore
  refreshingAuthProviderFactory: RefreshingAuthProviderFactory
  clientCredentialsAuthProviderFactory: ClientCredentialsAuthProviderFactory
}>

export default class TwurpleAuthProvider extends ContextClass {
  readonly name = TwurpleAuthProvider.name

  private readonly disableExternalApis: boolean
  private readonly isLive: boolean
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly fallbackAccessToken: string | null
  private readonly fallbackRefreshToken: string | null
  private readonly logService: LogService
  private readonly authStore: AuthStore
  private readonly refreshingAuthProviderFactory: RefreshingAuthProviderFactory
  private auth!: RefreshingAuthProvider
  private readonly clientAuth: ClientCredentialsAuthProvider

  constructor (deps: Deps) {
    super()
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.isLive = deps.resolve('isLive')
    this.clientId = deps.resolve('twitchClientId')
    this.clientSecret = deps.resolve('twitchClientSecret')
    this.fallbackAccessToken = deps.resolve('twitchAccessToken')
    this.fallbackRefreshToken = deps.resolve('twitchRefreshToken')
    this.logService = deps.resolve('logService')
    this.authStore = deps.resolve('authStore')
    this.refreshingAuthProviderFactory = deps.resolve('refreshingAuthProviderFactory')
    this.clientAuth = deps.resolve('clientCredentialsAuthProviderFactory').create(this.clientId, this.clientSecret)
  }

  public override async initialise (): Promise<void> {
    if (this.disableExternalApis) {
      return
    }

    // no error handling on purpose - if this fails, it should be considered a fatal error
    let token = await this.authStore.loadAccessToken()

    if (token != null) {
      this.logService.logDebug(this, 'Loaded database access token')
      if (!this.compareScopes(TWITCH_SCOPE, token.scope)) {
        throw new Error('The stored application scope differs from the expected scope. Please reset the Twitch authentication as described in the readme.')
      }

    } else if (this.fallbackAccessToken != null && this.fallbackRefreshToken != null) {
      this.logService.logDebug(this, 'Using fallback access token')
      token = {
        accessToken: this.fallbackAccessToken,
        refreshToken: this.fallbackRefreshToken,
        expiresIn: 0, // refresh immediately
        obtainmentTimestamp: 0,
        scope: TWITCH_SCOPE
      }
    } else {
      this.throwAuthError('No access token could be found in the database, and no fallback access token and refresh token have been provided in the .env file.')
    }

    this.auth = this.refreshingAuthProviderFactory.create({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      // async callbacks are allowed as per the example at https://twurple.js.org/docs/auth/providers/refreshing.html
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onRefresh: async (newToken: AccessToken) => await this.saveAccessToken(newToken)
    }, token!)
  }

  get () {
    return this.auth
  }

  getClientAuthProvider () {
    return this.clientAuth
  }

  private throwAuthError (message: string) {
    const scriptName = `yarn workspace server auth:twitch:${this.isLive ? 'release' : 'debug'}`
    throw new Error(`Unable to authenticate Twurple.\n${message}\nPlease run the following script:\n\n    ${scriptName}`)
  }

  private async saveAccessToken (token: AccessToken) {
    try {
      await this.authStore.saveAccessToken(token)
      this.logService.logDebug(this, 'Saved access token')
    } catch (e: any) {
      this.logService.logError(this, 'Failed to save access token', e.message)
    }
  }

  private compareScopes (expected: string[], actual: string[]): boolean {
    // the database does not retain ordering?
    return compareArrays([...expected].sort(), [...actual].sort())
  }
}
