import { YoutubeAuth } from '@prisma/client'
import { New } from '@rebel/server/models/entities'
import LogService from '@rebel/server/services/LogService'
import AuthStore from '@rebel/server/stores/AuthStore'
import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { InconsistentScopesError, YoutubeNotAuthorisedError } from '@rebel/shared/util/error'
import { OAuth2Client, Credentials } from 'google-auth-library'
import { GaxiosError } from 'gaxios'
import YoutubeAuthClientFactory from '@rebel/server/factories/YoutubeAuthClientFactory'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import AuthHelpers, { YoutubeAuthType } from '@rebel/server/helpers/AuthHelpers'

type Deps = Dependencies<{
  authStore: AuthStore
  channelId: string
  youtubeClientId: string
  youtubeClientSecret: string
  studioUrl: string
  logService: LogService
  disableExternalApis: boolean
  youtubeAuthClientFactory: YoutubeAuthClientFactory
  authHelpers: AuthHelpers
}>

// https://github.com/googleapis/google-api-nodejs-client#oauth2-client
export default class YoutubeAuthProvider extends SingletonContextClass {
  public readonly name = YoutubeAuthProvider.name

  private readonly authStore: AuthStore
  private readonly adminChannelId: string
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly studioUrl: string
  private readonly logService: LogService
  private readonly disableExternalApis: boolean
  private readonly youtubeAuthClientFactory: YoutubeAuthClientFactory
  private readonly authHelpers: AuthHelpers

  constructor (deps: Deps) {
    super()
    this.authStore = deps.resolve('authStore')
    this.adminChannelId = deps.resolve('channelId')
    this.clientId = deps.resolve('youtubeClientId')
    this.clientSecret = deps.resolve('youtubeClientSecret')
    this.studioUrl = deps.resolve('studioUrl')
    this.logService = deps.resolve('logService')
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.youtubeAuthClientFactory = deps.resolve('youtubeAuthClientFactory')
    this.authHelpers = deps.resolve('authHelpers')
  }

  public override async initialise (): Promise<void> {
    if (this.disableExternalApis) {
      this.logService.logInfo(this, 'Skipping initialisation because external APIs are disabled.')
      return
    }

    const token = await this.authStore.loadYoutubeAccessToken(this.adminChannelId)
    if (token == null) {
      throw new YoutubeNotAuthorisedError(this.adminChannelId)
    } else if (!this.authHelpers.compareYoutubeScopes('admin', token.scope.split(' '))) {
      await this.revokeYoutubeAccessToken(this.adminChannelId)
      this.logService.logError(this, 'The stored application scope differs from the expected scope. The stored authentication details have been removed and ChatMate must be re-authorised by the admin channel.')
      throw new InconsistentScopesError('stored')
    } else {
      this.logService.logDebug(this, 'Loaded Youtube admin access token')
      // note: as of now, the token is not used for anything. in the future, it can be used for sending messages from the ChatMate admin channel, for example
    }
  }

  public getAuthUrl (type: YoutubeAuthType) {
    const client = this.getClient(type)

    return client.generateAuthUrl({
      client_id: this.clientId,
      access_type: type === 'user' ? 'online' : 'offline', // allow refreshing streamer/admin tokens since we store these in the db
      redirect_uri: this.getRedirectUri(type),
      scope: this.authHelpers.getYoutubeScope(type)
    })
  }

  public getAuthFromCredentials (credentials: Credentials): OAuth2Client {
    const client = this.getClient('user')
    client.setCredentials(credentials)
    return client
  }

  public async getAuth (externalChannelId: string): Promise<OAuth2Client>
  public async getAuth (externalChannelId: 'admin'): Promise<OAuth2Client>
  public async getAuth (externalChannelId: string | 'admin'): Promise<OAuth2Client> {
    const isAdmin = externalChannelId === 'admin'
    externalChannelId = isAdmin ? this.adminChannelId : externalChannelId

    const existingToken = await this.authStore.loadYoutubeAccessToken(externalChannelId)
    if (existingToken == null) {
      throw new YoutubeNotAuthorisedError(externalChannelId)
    } else if (!this.authHelpers.compareYoutubeScopes(isAdmin ? 'admin' : 'streamer', existingToken.scope.split(' '))) {
      throw new InconsistentScopesError('stored')
    }

    const client = this.getClient(isAdmin ? 'admin' : 'streamer')

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    client.on('tokens', tokens => this.onTokenUpdated(externalChannelId, tokens))

    const credentials: Credentials = {
      access_token: existingToken.accessToken,
      expiry_date: existingToken.expiryDate.getTime(),
      refresh_token: existingToken.refreshToken,
      scope: existingToken.scope
    }
    client.setCredentials(credentials)

    return client
  }

  public async revokeYoutubeAccessToken (externalChannelId: 'admin'): Promise<void>
  public async revokeYoutubeAccessToken (externalChannelId: string): Promise<void>
  public async revokeYoutubeAccessToken (externalChannelId: string | 'admin'): Promise<void> {
    const isAdmin = externalChannelId === 'admin'
    externalChannelId = isAdmin ? this.adminChannelId : externalChannelId

    const client = this.getClient(isAdmin ? 'admin' : 'streamer')
    const token = await this.authStore.loadYoutubeAccessToken(externalChannelId)
    if (token == null) {
      throw new YoutubeNotAuthorisedError(externalChannelId)
    }

    try {
      await client.revokeToken(token.accessToken)
    } catch (e: any) {
      if (e instanceof GaxiosError && e.message === 'invalid_token') {
        // ignore
      } else {
        throw e
      }
    }

    await this.authStore.tryDeleteYoutubeAccessToken(externalChannelId)
    this.logService.logInfo(this, `Revoked access token for channel ${externalChannelId}`)
  }

  private async onTokenUpdated (externalChannelId: string, token: Credentials) {
    const youtubeAuth: New<YoutubeAuth> = {
      externalYoutubeChannelId: externalChannelId,
      accessToken: token.access_token!,
      refreshToken: token.refresh_token!,
      scope: token.scope!,
      expiryDate: new Date(token.expiry_date!),
      timeObtained: new Date()
    }

    try {
      await this.authStore.saveYoutubeAccessToken(youtubeAuth)
      this.logService.logDebug(this, `Refreshed and stored new access token for channel ${externalChannelId} (is admin: ${externalChannelId === this.adminChannelId})`)
    } catch (e: any) {
      this.logService.logError(this, `Refreshed access token for channel ${externalChannelId} (is admin: ${externalChannelId === this.adminChannelId}) but failed to save.`, e)
    }
  }

  // the youtube api won't be used very often, there's no good reason to keep these clients in memory
  public getClient (type: YoutubeAuthType): OAuth2Client {
    return this.youtubeAuthClientFactory.create(this.clientId, this.clientSecret, this.getRedirectUri(type))
  }

  // must match exactly what is set up in the google dev console
  private getRedirectUri (type: YoutubeAuthType) {
    if (type === 'admin') {
      return this.studioUrl + '/admin/youtube'
    } else if (type === 'streamer') {
      return this.studioUrl + '/manager'
    } else if (type === 'user') {
      return this.studioUrl + '/link'
    } else {
      assertUnreachable(type)
    }
  }
}
