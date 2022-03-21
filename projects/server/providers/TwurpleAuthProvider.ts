import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider from '@rebel/server/providers/DbProvider'
import IProvider from '@rebel/server/providers/IProvider'
import LogService from '@rebel/server/services/LogService'
import { AccessToken, AuthProvider, RefreshingAuthProvider } from '@twurple/auth'

type Deps = Dependencies<{
  isLive: boolean
  twitchClientId: string
  twitchClientSecret: string
  twitchAccessToken: string | null
  twitchRefreshToken: string | null
  dbProvider: DbProvider
  logService: LogService
}>

export default class TwurpleAuthProvider extends ContextClass implements IProvider<AuthProvider> {
  readonly name = TwurpleAuthProvider.name

  private readonly isLive: boolean
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly fallbackAccessToken: string | null
  private readonly fallbackRefreshToken: string | null
  private readonly dbProvider: DbProvider
  private readonly logService: LogService
  private auth!: RefreshingAuthProvider

  constructor (deps: Deps) {
    super()
    this.isLive = deps.resolve('isLive')
    this.clientId = deps.resolve('twitchClientId')
    this.clientSecret = deps.resolve('twitchClientSecret')
    this.fallbackAccessToken = deps.resolve('twitchAccessToken')
    this.fallbackRefreshToken = deps.resolve('twitchRefreshToken')
    this.dbProvider = deps.resolve('dbProvider')
    this.logService = deps.resolve('logService')
  }

  public override async initialise (): Promise<void> {
    let token = await this.loadAccessToken()

    if (token != null) {
      this.logService.logDebug(this, 'Loaded database access token')
    } else if (this.fallbackAccessToken != null && this.fallbackRefreshToken != null) {
      this.logService.logDebug(this, 'Using fallback access token')
      token = {
        accessToken: this.fallbackAccessToken,
        refreshToken: this.fallbackRefreshToken,
        expiresIn: 0, // refresh immediately
        obtainmentTimestamp: 0,
        // future-proofing for when we want to do non-read-only actions
        scope: ['chat:read', 'chat:edit']
      }
    } else {
      this.throwAuthError('No access token could be found in the database, and no fallback access token and refresh token have been provided in the .env file.')
    }

    this.auth = new RefreshingAuthProvider({
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

  private throwAuthError (message: string) {
    const scriptName = `yarn workspace server auth:twitch:${this.isLive ? 'release' : 'debug'}`
    throw new Error(`Unable to authenticate Twurple.\n${message}\nPlease run the following script:\n\n    ${scriptName}`)
  }

  private async loadAccessToken (): Promise<AccessToken | null> {
    // no error handling on purpose - if this fails, it should be considered a fatal error
    const auth = await this.dbProvider.get().twitchAuth.findUnique({ where: { clientId: this.clientId }})

    if (auth == null) {
      return null
    } else {
      return {
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        expiresIn: auth.expiresIn,
        obtainmentTimestamp: auth.obtainmentTimestamp,
        scope: auth.scope.split(',')
      }
    }
  }

  private async saveAccessToken (token: AccessToken) {
    const tokenData = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken!,
      expiresIn: token.expiresIn!,
      obtainmentTimestamp: token.obtainmentTimestamp,
      scope: token.scope.join(',')
    }

    try {
      await this.dbProvider.get().twitchAuth.upsert({
        create: { clientId: this.clientId, ...tokenData },
        where: { clientId: this.clientId },
        update: { ...tokenData }
      })
      this.logService.logInfo(this, 'Saved access token')
    } catch (e: any) {
      this.logService.logError(this, 'Failed to save access token', e.message)
    }
  }
}
