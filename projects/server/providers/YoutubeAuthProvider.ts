import { YoutubeAuth } from '@prisma/client'
import { YOUTUBE_SCOPE } from '@rebel/server/constants'
import { New } from '@rebel/server/models/entities'
import LogService from '@rebel/server/services/LogService'
import AuthStore from '@rebel/server/stores/AuthStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { compareArrays } from '@rebel/shared/util/arrays'
import { InconsistentScopesError, YoutubeNotAuthorisedError } from '@rebel/shared/util/error'
import { OAuth2Client, Credentials } from 'google-auth-library'
import { GaxiosError } from 'gaxios'
import YoutubeAuthClientFactory from '@rebel/server/factories/YoutubeAuthClientFactory'

type Deps = Dependencies<{
  authStore: AuthStore
  channelId: string
  youtubeClientId: string
  youtubeClientSecret: string
  studioUrl: string
  logService: LogService
  disableExternalApis: boolean
  youtubeAuthClientFactory: YoutubeAuthClientFactory
}>

// https://github.com/googleapis/google-api-nodejs-client#oauth2-client
export default class YoutubeAuthProvider extends ContextClass {
  public readonly name = YoutubeAuthProvider.name

  private readonly authStore: AuthStore
  private readonly adminChannelId: string
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly studioUrl: string
  private readonly logService: LogService
  private readonly disableExternalApis: boolean
  private readonly youtubeAuthClientFactory: YoutubeAuthClientFactory

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
  }

  public override async initialise (): Promise<void> {
    if (this.disableExternalApis) {
      return
    }

    const token = await this.authStore.loadYoutubeAccessToken(this.adminChannelId)
    if (token == null) {
      throw new YoutubeNotAuthorisedError(this.adminChannelId)
    } else if (!compareScopes(YOUTUBE_SCOPE, token.scope.split(' '))) {
      await this.revokeYoutubeAccessToken(this.adminChannelId)
      this.logService.logError(this, 'The stored application scope differs from the expected scope. The stored authentication details have been removed and ChatMate must be re-authorised by the admin channel.')
      throw new InconsistentScopesError('stored')
    } else {
      this.logService.logDebug(this, 'Loaded Youtube admin access token')
      // note: as of now, the token is not used for anything. in the future, it can be used for sending messages from the ChatMate admin channel, for example
    }
  }

  public getAuthUrl (isAdmin: boolean) {
    const client = this.getClient(isAdmin)

    return client.generateAuthUrl({
      client_id: this.clientId,
      access_type: 'offline', // allow refreshing
      redirect_uri: this.getRedirectUri(isAdmin),
      scope: YOUTUBE_SCOPE
    })
  }

  public async authoriseChannel (code: string, externalChannelId: 'admin'): Promise<void>
  public async authoriseChannel (code: string, externalChannelId: string): Promise<void>
  public async authoriseChannel (code: string, externalChannelId: string | 'admin'): Promise<void> {
    const isAdmin = externalChannelId === 'admin'

    const client = this.getClient(isAdmin)
    const token = await client.getToken(code).then(res => res.tokens)

    if (!compareScopes(YOUTUBE_SCOPE, token.scope!.split(' '))) {
      const result = await client.revokeToken(token.access_token!)
      this.logService.logInfo(this, `User authorised ChatMate, but did not grant all requested permissions. Successfully revoked token: ${result.data.success}`)
      throw new InconsistentScopesError('authenticated')
    }

    // note: we have no way of knowing what channel this code is actually for
    // (technically it's not even for a channel, but a google user that might own multiple channels)
    const youtubeAuth: New<YoutubeAuth> = {
      externalYoutubeChannelId: isAdmin ? this.adminChannelId : externalChannelId,
      accessToken: token.access_token!,
      refreshToken: token.refresh_token!,
      scope: token.scope!,
      expiryDate: new Date(token.expiry_date!),
      timeObtained: new Date()
    }
    await this.authStore.saveYoutubeAccessToken(youtubeAuth)

    this.logService.logInfo(this, `Youtube channel ${externalChannelId} (isAdmin: ${isAdmin}) has authorised ChatMate.`)
  }

  // admin auth: used for managing moderators. streamer auth: used for punishments
  public async getAuth (externalChannelId: string): Promise<OAuth2Client>
  public async getAuth (externalChannelId: 'admin'): Promise<OAuth2Client>
  public async getAuth (externalChannelId: string | 'admin'): Promise<OAuth2Client> {
    const isAdmin = externalChannelId === 'admin'
    externalChannelId = isAdmin ? this.adminChannelId : externalChannelId

    const existingToken = await this.authStore.loadYoutubeAccessToken(externalChannelId)
    if (existingToken == null) {
      throw new YoutubeNotAuthorisedError(externalChannelId)
    } else if (!compareScopes(YOUTUBE_SCOPE, existingToken.scope.split(' '))) {
      throw new InconsistentScopesError('stored')
    }

    const client = this.getClient(isAdmin)

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
    externalChannelId = externalChannelId === 'admin' ? this.adminChannelId : externalChannelId

    const client = this.getClient(true)
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

  // the youtube api won't be used very often, there's no good reason to keep these clients in memorya
  private getClient (isAdmin: boolean): OAuth2Client {
    return this.youtubeAuthClientFactory.create(this.clientId, this.clientSecret, this.getRedirectUri(isAdmin))
  }

  // must match exactly what is set up in the google dev console
  private getRedirectUri (isAdmin: boolean) {
    return isAdmin ? this.studioUrl + '/admin/youtube' : this.studioUrl + '/manager'
  }
}

function compareScopes (expected: string[], actual: string[]): boolean {
  return compareArrays([...expected].sort(), [...actual].sort())
}
