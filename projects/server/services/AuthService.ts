import { YoutubeAuth } from '@prisma/client'
import AuthHelpers from '@rebel/server/helpers/AuthHelpers'
import { New } from '@rebel/server/models/entities'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import YoutubeAuthProvider from '@rebel/server/providers/YoutubeAuthProvider'
import { getUserName } from '@rebel/server/services/ChannelService'
import LogService from '@rebel/server/services/LogService'
import WebService from '@rebel/server/services/WebService'
import YoutubeApiProxyService from '@rebel/server/services/YoutubeApiProxyService'
import AuthStore from '@rebel/server/stores/AuthStore'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { single } from '@rebel/shared/util/arrays'
import { ChatMateError, InconsistentScopesError, InvalidAuthenticatedChannelError, PrimaryChannelNotFoundError } from '@rebel/shared/util/error'
import { AccessToken } from '@twurple/auth/lib'

type TwitchAuthResponse = {
  access_token: string
  expires_in: number
  refresh_token: string
  token_type: 'bearer'
  scope?: string[]
}

type Deps = Dependencies<{
  logService: LogService
  youtubeAuthProvider: YoutubeAuthProvider
  youtubeApiProxyService: YoutubeApiProxyService
  channelId: string
  authStore: AuthStore
  streamerChannelStore: StreamerChannelStore
  authHelpers: AuthHelpers
  webService: WebService
  twurpleAuthProvider: TwurpleAuthProvider
  twitchUsername: string
  twurpleApiClientProvider: TwurpleApiClientProvider
}>

export default class AuthService extends ContextClass {
  public readonly name = AuthService.name

  private readonly logService: LogService
  private readonly youtubeAuthProvider: YoutubeAuthProvider
  private readonly youtubeApiProxyService: YoutubeApiProxyService
  private readonly youtubeAdminChannelId: string
  private readonly authStore: AuthStore
  private readonly streamerChannelStore: StreamerChannelStore
  private readonly authHelpers: AuthHelpers
  private readonly webService: WebService
  private readonly twurpleAuthProvider: TwurpleAuthProvider
  private readonly twitchUsername: string
  private readonly twurpleApiClientProvider: TwurpleApiClientProvider

  constructor (deps: Deps) {
    super()

    this.logService = deps.resolve('logService')
    this.youtubeAuthProvider = deps.resolve('youtubeAuthProvider')
    this.youtubeApiProxyService = deps.resolve('youtubeApiProxyService')
    this.youtubeAdminChannelId = deps.resolve('channelId')
    this.authStore = deps.resolve('authStore')
    this.streamerChannelStore = deps.resolve('streamerChannelStore')
    this.authHelpers = deps.resolve('authHelpers')
    this.webService = deps.resolve('webService')
    this.twurpleAuthProvider = deps.resolve('twurpleAuthProvider')
    this.twitchUsername = deps.resolve('twitchUsername')
    this.twurpleApiClientProvider = deps.resolve('twurpleApiClientProvider')
  }

  public async authoriseYoutubeAdmin (code: string): Promise<void> {
    const client = this.youtubeAuthProvider.getClient('admin')
    const token = await client.getToken(code).then(res => res.tokens)

    if (!this.authHelpers.compareYoutubeScopes('admin', token.scope!.split(' '))) {
      const result = await client.revokeToken(token.access_token!)
      this.logService.logInfo(this, `Admin has authorised ChatMate on Youtube, but did not grant all requested permissions. Successfully revoked token: ${result.data.success}`)
      throw new InconsistentScopesError('authenticated')
    }

    const ownedChannels = await this.youtubeApiProxyService.getOwnedChannels(token)
    const ownedChannelIds = ownedChannels.map(c => c.id)
    if (!ownedChannelIds.includes(this.youtubeAdminChannelId)) {
      const result = await client.revokeToken(token.access_token!)
      this.logService.logInfo(this, `Admin has authorised ChatMate on Youtube, but granted permission to the wrong channel (expected ${this.youtubeAdminChannelId}, received ${ownedChannelIds.join(', ')}). Successfully revoked token: ${result.data.success}`)
      throw new InvalidAuthenticatedChannelError(this.youtubeAdminChannelId, ownedChannelIds.join(', '))
    }

    const youtubeAuth: New<YoutubeAuth> = {
      externalYoutubeChannelId: this.youtubeAdminChannelId,
      accessToken: token.access_token!,
      refreshToken: token.refresh_token!,
      scope: token.scope!,
      expiryDate: new Date(token.expiry_date!),
      timeObtained: new Date()
    }
    await this.authStore.saveYoutubeAccessToken(youtubeAuth)

    this.logService.logInfo(this, `Youtube channel ${this.youtubeAdminChannelId} (admin) has authorised ChatMate.`)
  }

  public async authoriseYoutubeStreamer (code: string, streamerId: number): Promise<void> {
    const primaryChannels = await this.streamerChannelStore.getPrimaryChannels([streamerId]).then(single)
    if (primaryChannels.youtubeChannel == null) {
      throw new PrimaryChannelNotFoundError(streamerId, 'youtube')
    }

    const client = this.youtubeAuthProvider.getClient('streamer')
    const token = await client.getToken(code).then(res => res.tokens)

    if (!this.authHelpers.compareYoutubeScopes('streamer', token.scope!.split(' '))) {
      const result = await client.revokeToken(token.access_token!)
      this.logService.logInfo(this, `Streamer ${streamerId} has authorised ChatMate on Youtube, but did not grant all requested permissions. Successfully revoked token: ${result.data.success}`)
      throw new InconsistentScopesError('authenticated')
    }

    const ownedChannels = await this.youtubeApiProxyService.getOwnedChannels(token)
    const ownedChannelIds = ownedChannels.map(c => c.id)
    const expectedChannelId = primaryChannels.youtubeChannel.platformInfo.channel.youtubeId
    if (!ownedChannelIds.includes(expectedChannelId)) {
      const result = await client.revokeToken(token.access_token!)
      this.logService.logInfo(this, `Streamer ${streamerId} has authorised ChatMate on Youtube, but granted permission to the wrong channel (expected ${expectedChannelId}, received ${ownedChannelIds.join(', ')}). Successfully revoked token: ${result.data.success}`)
      throw new InvalidAuthenticatedChannelError(expectedChannelId, ownedChannelIds.join(', '))
    }

    const youtubeAuth: New<YoutubeAuth> = {
      externalYoutubeChannelId: expectedChannelId,
      accessToken: token.access_token!,
      refreshToken: token.refresh_token!,
      scope: token.scope!,
      expiryDate: new Date(token.expiry_date!),
      timeObtained: new Date()
    }
    await this.authStore.saveYoutubeAccessToken(youtubeAuth)

    this.logService.logInfo(this, `Youtube channel ${expectedChannelId} (streamer: ${streamerId}) has authorised ChatMate.`)
  }

  /** Temporarily authorises the user and returns information about the user's single owned channel. */
  public async authoriseYoutubeUserAndGetChannel (code: string): Promise<{ id: string, name: string, image: string }> {
    const client = this.youtubeAuthProvider.getClient('user')
    const token = await client.getToken(code).then(res => res.tokens)

    if (!this.authHelpers.compareYoutubeScopes('user', token.scope!.split(' '))) {
      const result = await client.revokeToken(token.access_token!)
      this.logService.logInfo(this, `A user has authorised ChatMate on Youtube, but did not grant all requested permissions. Successfully revoked token: ${result.data.success}`)
      throw new InconsistentScopesError('authenticated')
    }

    const ownedChannels = await this.youtubeApiProxyService.getOwnedChannels(token)
    if (ownedChannels.length !== 1) {
      const result = await client.revokeToken(token.access_token!)
      this.logService.logError(this, `A user has authorised ChatMate on Youtube, but owns multiple channels (${ownedChannels.join(', ')}). Successfully revoked token: ${result.data.success}`)
      throw new ChatMateError('ChatMate is unable to process the request as the authorising user owns multiple channels. Please contact an admin to fix the issue.')
    }

    const channel = single(ownedChannels)

    // remove auth info - this authorisation was temporary, used solely to get the user's channel information
    const revokationResult = await client.revokeToken(token.access_token!)
    if (!revokationResult.data.success) {
      this.logService.logError(this, `A user successfully authorised ChatMate on Youtube (channel ${channel.name} with id ${channel.id}), but unable to revoke the access token`)
    }

    return channel
  }

  public async authoriseTwitchAdmin (authorisationCode: string): Promise<void> {
    // fetch token
    const url = this.twurpleAuthProvider.getAuthorisationUrl('admin', authorisationCode)
    const rawResponse = await this.webService.fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
    if (!rawResponse.ok) {
      const message = `Twitch auth response was status ${rawResponse.status}: ${await rawResponse.text()}`
      this.logService.logError(this, `Failed to authorise Twitch app for admin. ${message}`)
      throw new ChatMateError(message)
    }
    const response = await rawResponse.json() as TwitchAuthResponse

    // check scopes
    if (!this.authHelpers.compareTwitchScopes('admin', response.scope ?? [])) {
      let revokeResult: boolean
      try {
        revokeResult = await this.twurpleAuthProvider.revokeAccessToken(response.access_token)
      } catch (e: any) {
        this.logService.logError(this, 'Failed to revoke authorisation token for admin:', e)
        revokeResult = false
      }
      this.logService.logInfo(this, `Admin has authorised ChatMate on Twitch, but did not grant all requested permissions. Successfully revoked token: ${revokeResult}. Granted scopes:`, response.scope)
      throw new InconsistentScopesError('authenticated')
    }

    // check user
    const staticClient = this.twurpleApiClientProvider.getStaticClient(response.access_token)
    const user = await staticClient.users.getAuthenticatedUser('__unused__', false)
    if (user.name.toLowerCase() !== this.twitchUsername.toLowerCase()) {
      const revokeResult = await this.twurpleAuthProvider.revokeAccessToken(response.access_token)
      this.logService.logInfo(this, `Admin has authorised ChatMate on Twitch, but granted permission to the wrong channel (expected ${this.twitchUsername}, received ${user.name}). Successfully revoked token: ${revokeResult}`)
      throw new InvalidAuthenticatedChannelError(this.twitchUsername, user.name)
    }

    // save token
    const token: AccessToken = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      scope: response.scope ?? [],
      expiresIn: 0,
      obtainmentTimestamp: 0
    }
    await this.authStore.saveTwitchAccessToken(user.id, this.twitchUsername, token)

    // invalidate the existing access token so that the next request will fetch the updated one
    this.twurpleAuthProvider.removeTokenForUser(user.id)

    this.logService.logInfo(this, `Successfully updated Twitch access token for admin.`)
  }

  /** Once the user has authorised ChatMate, this method gets an access token and saves it to the database. */
  public async authoriseTwitchStreamer (streamerId: number, code: string): Promise<void> {
    const primaryChannel = await this.streamerChannelStore.getPrimaryChannels([streamerId]).then(single)
    if (primaryChannel.twitchChannel == null) {
      throw new PrimaryChannelNotFoundError(streamerId, 'twitch')
    }

    // fetch token
    const url = this.twurpleAuthProvider.getAuthorisationUrl('streamer', code)
    const rawResponse = await this.webService.fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
    if (!rawResponse.ok) {
      const message = `Twitch auth response was status ${rawResponse.status}: ${await rawResponse.text()}`
      this.logService.logError(this, `Failed to authorise Twitch app for streamer ${streamerId}. ${message}`)
      throw new ChatMateError(message)
    }
    const response = await rawResponse.json() as TwitchAuthResponse

    // check scopes
    if (!this.authHelpers.compareTwitchScopes('streamer', response.scope ?? [])) {
      let revokeResult: boolean
      try {
        revokeResult = await this.twurpleAuthProvider.revokeAccessToken(response.access_token)
      } catch (e: any) {
        this.logService.logError(this, 'Failed to revoke authorisation token for admin:', e)
        revokeResult = false
      }
      this.logService.logInfo(this, `Streamer ${streamerId} has authorised ChatMate on Twitch, but did not grant all requested permissions. Successfully revoked token: ${revokeResult}. Granted scopes:`, response.scope)
      throw new InconsistentScopesError('authenticated')
    }

    // check user
    const staticClient = this.twurpleApiClientProvider.getStaticClient(response.access_token)
    const user = await staticClient.users.getAuthenticatedUser('__unused__', false)
    const twitchChannelName = getUserName(primaryChannel.twitchChannel)
    if (user.name.toLowerCase() !== twitchChannelName.toLowerCase()) {
      const revokeResult = await this.twurpleAuthProvider.revokeAccessToken(response.access_token)
      this.logService.logInfo(this, `Streamer ${streamerId} has authorised ChatMate on Twitch, but granted permission to the wrong channel (expected ${twitchChannelName}, received ${user.name}). Successfully revoked token: ${revokeResult}`)
      throw new InvalidAuthenticatedChannelError(twitchChannelName, user.name)
    }

    // save token
    const token: AccessToken = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      scope: response.scope ?? [],
      expiresIn: 0,
      obtainmentTimestamp: 0
    }
    const twitchUserId = primaryChannel.twitchChannel.platformInfo.channel.twitchId
    await this.authStore.saveTwitchAccessToken(twitchUserId, twitchChannelName, token)

    // invalidate the existing access token so that the next request will fetch the updated one
    this.twurpleAuthProvider.removeTokenForUser(twitchUserId)

    this.logService.logInfo(this, `Successfully updated Twitch access token for streamer ${streamerId} (twitch channel '${twitchChannelName}').`)
  }

  public async authoriseTwitchUserAndGetChannel (authorisationCode: string): Promise<{ id: string, name: string, displayName: string }> {
    // fetch token
    const url = this.twurpleAuthProvider.getAuthorisationUrl('user', authorisationCode)
    const rawResponse = await this.webService.fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
    if (!rawResponse.ok) {
      const message = `Twitch auth response was status ${rawResponse.status}: ${await rawResponse.text()}`
      this.logService.logError(this, `Failed to authorise Twitch app for user. ${message}`)
      throw new ChatMateError(message)
    }
    const response = await rawResponse.json() as TwitchAuthResponse

    // check scopes
    if (!this.authHelpers.compareTwitchScopes('user', response.scope ?? [])) {
      let revokeResult: boolean
      try {
        revokeResult = await this.twurpleAuthProvider.revokeAccessToken(response.access_token)
      } catch (e: any) {
        this.logService.logError(this, 'Failed to revoke authorisation token for admin:', e)
        revokeResult = false
      }
      this.logService.logInfo(this, `User has authorised ChatMate on Twitch, but did not grant all requested permissions. Successfully revoked token: ${revokeResult}. Granted scopes:`, response.scope)
      throw new InconsistentScopesError('authenticated')
    }

    const staticClient = this.twurpleApiClientProvider.getStaticClient(response.access_token)
    const user = await staticClient.users.getAuthenticatedUser('__unused__', false)

    // remove access token - this authorisation was temporary, used solely to get the user's channel information
    const revokeResult = await this.twurpleAuthProvider.revokeAccessToken(response.access_token)
    if (!revokeResult) {
      this.logService.logError(this, `User ${user.name} has authorised ChatMate on Twitch, but ChatMate failed to revoke the access token`)
    }

    return { id: user.id, name: user.name, displayName: user.displayName }
  }
}
