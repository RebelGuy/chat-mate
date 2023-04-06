import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import ClientCredentialsAuthProviderFactory from '@rebel/server/factories/ClientCredentialsAuthProviderFactory'
import RefreshingAuthProviderFactory from '@rebel/server/factories/RefreshingAuthProviderFactory'
import { NodeEnv } from '@rebel/server/globals'
import LogService from '@rebel/server/services/LogService'
import AuthStore from '@rebel/server/stores/AuthStore'
import { compareArrays } from '@rebel/shared/util/arrays'
import { AccessToken, ClientCredentialsAuthProvider, RefreshingAuthProvider } from '@twurple/auth'

// see https://dev.twitch.tv/docs/authentication/scopes for available scopes.
// see https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/ to determine which scope an event subscription needs.
// if you edit the scopes here, you must request a new access token via Studio.
export const TWITCH_SCOPE = ['chat:read', 'chat:edit', 'moderation:read', 'moderator:manage:banned_users', 'channel:moderate', 'moderator:read:followers']

type Deps = Dependencies<{
  disableExternalApis: boolean
  nodeEnv: NodeEnv
  twitchClientId: string
  twitchClientSecret: string
  logService: LogService
  authStore: AuthStore
  refreshingAuthProviderFactory: RefreshingAuthProviderFactory
  clientCredentialsAuthProviderFactory: ClientCredentialsAuthProviderFactory
}>

export default class TwurpleAuthProvider extends ContextClass {
  readonly name = TwurpleAuthProvider.name

  private readonly disableExternalApis: boolean
  private readonly nodeEnv: NodeEnv
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly logService: LogService
  private readonly authStore: AuthStore
  private readonly refreshingAuthProviderFactory: RefreshingAuthProviderFactory
  private auth!: RefreshingAuthProvider
  private readonly clientAuth: ClientCredentialsAuthProvider

  constructor (deps: Deps) {
    super()
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.nodeEnv = deps.resolve('nodeEnv')
    this.clientId = deps.resolve('twitchClientId')
    this.clientSecret = deps.resolve('twitchClientSecret')
    this.logService = deps.resolve('logService')
    this.authStore = deps.resolve('authStore')
    this.refreshingAuthProviderFactory = deps.resolve('refreshingAuthProviderFactory')
    this.clientAuth = deps.resolve('clientCredentialsAuthProviderFactory').create(this.clientId, this.clientSecret)
  }

  public override async initialise (): Promise<void> {
    if (this.disableExternalApis) {
      return
    }

    // eslint-disable-next-line @typescript-eslint/semi
    let token: AccessToken; // for some reason this semicolon is required to help vscode with syntax highlighting in this file......
    try {
      token = await this.authStore.loadTwitchAccessToken()
    } catch (e: any) {
      const scriptName = `yarn workspace server auth:twitch:${this.nodeEnv}`
      throw new Error(`Unable to authenticate Twurple.\n${e.message}\nPlease run the following script:\n\n    ${scriptName}`)
    }

    this.logService.logDebug(this, 'Loaded database access token')
    if (!this.compareScopes(TWITCH_SCOPE, token.scope)) {
      throw new Error('The stored application scope differs from the expected scope. Please reset the Twitch authentication as described in the readme.')
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

  private async saveAccessToken (token: AccessToken) {
    try {
      await this.authStore.saveTwitchAccessToken(token)
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
