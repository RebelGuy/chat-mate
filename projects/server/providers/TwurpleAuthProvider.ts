import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import AppTokenAuthProviderFactory from '@rebel/server/factories/AppTokenAuthProviderFactory'
import RefreshingAuthProviderFactory from '@rebel/server/factories/RefreshingAuthProviderFactory'
import LogService from '@rebel/server/services/LogService'
import AuthStore from '@rebel/server/stores/AuthStore'
import { compareArrays } from '@rebel/shared/util/arrays'
import { AccessToken, AppTokenAuthProvider, RefreshingAuthProvider } from '@twurple/auth'
import { TWITCH_SCOPE } from '@rebel/server/constants'
import { waitUntil } from '@rebel/shared/util/typescript'
import { AuthorisationExpiredError, InconsistentScopesError, NotAuthorisedError } from '@rebel/shared/util/error'

type Deps = Dependencies<{
  disableExternalApis: boolean
  twitchClientId: string
  twitchClientSecret: string
  twitchUsername: string
  logService: LogService
  authStore: AuthStore
  refreshingAuthProviderFactory: RefreshingAuthProviderFactory
  appTokenAuthProviderFactory: AppTokenAuthProviderFactory
}>

const CHAT_INTENT = 'chat'

export default class TwurpleAuthProvider extends ContextClass {
  readonly name = TwurpleAuthProvider.name

  private readonly disableExternalApis: boolean
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly twitchUsername: string
  private readonly logService: LogService
  private readonly authStore: AuthStore
  private readonly refreshingAuthProviderFactory: RefreshingAuthProviderFactory
  private userTokenAuthProvider!: RefreshingAuthProvider
  private readonly appTokenAuthProvider: AppTokenAuthProvider
  private isInitialised: boolean

  constructor (deps: Deps) {
    super()
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.clientId = deps.resolve('twitchClientId')
    this.clientSecret = deps.resolve('twitchClientSecret')
    this.twitchUsername = deps.resolve('twitchUsername')
    this.logService = deps.resolve('logService')
    this.authStore = deps.resolve('authStore')
    this.refreshingAuthProviderFactory = deps.resolve('refreshingAuthProviderFactory')
    this.appTokenAuthProvider = deps.resolve('appTokenAuthProviderFactory').create(this.clientId, this.clientSecret)
    this.isInitialised = false
  }

  public override async initialise (): Promise<void> {
    if (this.disableExternalApis) {
      return
    }

    const token = await this.authStore.loadTwitchAccessTokenByChannelName(this.twitchUsername)
    this.logService.logDebug(this, 'Loaded Twitch admin access token')

    if (!this.compareScopes(TWITCH_SCOPE, token.scope)) {
      throw new Error('The stored application scope differs from the expected scope. Please reset the Twitch authentication as described in the readme.')
    }

    this.userTokenAuthProvider = this.refreshingAuthProviderFactory.create({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      // async callbacks are allowed as per the example at https://twurple.js.org/docs/auth/providers/refreshing.html
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onRefresh: async (twitchUserId: string, newToken: AccessToken) => await this.saveAccessToken(twitchUserId, newToken),
      onRefreshFailure: async (twitchUserId: string) => await this.onRefreshFailure(twitchUserId)
    })

    await this.userTokenAuthProvider.addUserForToken(token!, [CHAT_INTENT]) // i don't understand intents
    this.isInitialised = true
  }

  /** Use this provided if you want to make requests on behalf of the user. The access token will be loaded in, if it exists.
   * @throws {@link NotAuthorisedError}: When the user has not yet provided authorisation for ChatMate to act on their behalf.
   * @throws {@link AuthorisationExpiredError}: When the user has provided authorisation for ChatMate to act on their behalf, but it has expired and is no longer valid.
   * @throws {@link InconsistentScopesError}: When the user has provided authorisation for ChatMate to act on their behalf, but the scopes required by ChatMate to function properly have changed.
   */
  public async getUserTokenAuthProvider (twitchUserId: string) {
    await waitUntil(() => this.isInitialised, 100, 5000)

    if (!this.userTokenAuthProvider.hasUser(twitchUserId)) {
      try {
        const token = await this.authStore.loadTwitchAccessToken(twitchUserId)
        this.userTokenAuthProvider.addUser(twitchUserId, token)
        try {
          await this.userTokenAuthProvider.refreshAccessTokenForUser(twitchUserId)
        } catch (innerError: any) {
          await this.onRefreshFailure(twitchUserId)
          throw new AuthorisationExpiredError()
        }
      } catch (e: any) {
        // is there a better way to do this? probably
        if (e instanceof AuthorisationExpiredError) {
          throw e
        } else {
          throw new NotAuthorisedError(twitchUserId)
        }
      }
    }

    const scopes = this.userTokenAuthProvider.getCurrentScopesForUser(twitchUserId)
    if (!this.compareScopes(TWITCH_SCOPE, scopes)) {
      throw new InconsistentScopesError()
    }

    return this.userTokenAuthProvider
  }

  /** Only use this if you intend to make requests on behalf of the admin Twitch channel - otherwise, you will probably get an authentication error. */
  public getUserTokenAuthProviderForAdmin () {
    return this.userTokenAuthProvider
  }

  public hasTokenForUser (twitchUserId: string) {
    return this.userTokenAuthProvider.hasUser(twitchUserId)
  }

  public removeTokenForUser (twitchUserId: string) {
    this.userTokenAuthProvider.removeUser(twitchUserId)
  }

  // uses the client credentials grant flow (using a non-scoped app access token)
  public getAppTokenAuthProvider () {
    return this.appTokenAuthProvider
  }

  private async onRefreshFailure (twitchUserId: string) {
    this.logService.logWarning(this, `Unable to refresh token for Twitch user ID ${twitchUserId}. Removing saved access token from the DB.`)
    await this.deleteAccessToken(twitchUserId)
    this.removeTokenForUser(twitchUserId)
  }

  private async saveAccessToken (twitchUserId: string, token: AccessToken) {
    const isAdmin = await this.isAdminUserId(twitchUserId)

    try {
      await this.authStore.saveTwitchAccessToken(twitchUserId, isAdmin ? this.twitchUsername : null, token)
      this.logService.logDebug(this, `Saved access token for Twitch user ${twitchUserId}${isAdmin ? ` (ChatMate admin channel ${this.twitchUsername})`: ''}.`)
    } catch (e: any) {
      this.logService.logError(this, `Failed to save access token for Twitch user ${twitchUserId}${isAdmin ? ` (ChatMate admin channel ${this.twitchUsername})`: ''}.`, e.message)
    }
  }

  private async deleteAccessToken (twitchUserId: string) {
    const isAdmin = await this.isAdminUserId(twitchUserId)

    try {
      await this.authStore.tryDeleteTwitchAccessToken(twitchUserId)
      this.logService.logDebug(this, `Deleted access token for Twitch user ${twitchUserId}${isAdmin ? ` (ChatMate admin channel ${this.twitchUsername})`: ''}.`)
    } catch (e: any) {
      this.logService.logError(this, `Failed to delete access token for Twitch user ${twitchUserId}${isAdmin ? ` (ChatMate admin channel ${this.twitchUsername})`: ''}.`, e.message)
    }
  }

  private compareScopes (expected: string[], actual: string[]): boolean {
    // the database does not retain ordering?
    return compareArrays([...expected].sort(), [...actual].sort())
  }

  // Twurple magically finds the userId for us after we have added the admin user
  private async isAdminUserId (twitchUserId: string) {
    await waitUntil(() => this.isInitialised, 100, 5000)
    return this.userTokenAuthProvider.getIntentsForUser(twitchUserId).includes(CHAT_INTENT)
  }
}
