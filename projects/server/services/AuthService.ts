import { YoutubeAuth } from '@prisma/client'
import AuthHelpers from '@rebel/server/helpers/AuthHelpers'
import { New } from '@rebel/server/models/entities'
import YoutubeAuthProvider from '@rebel/server/providers/YoutubeAuthProvider'
import LogService from '@rebel/server/services/LogService'
import YoutubeApiProxyService from '@rebel/server/services/YoutubeApiProxyService'
import AuthStore from '@rebel/server/stores/AuthStore'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { single } from '@rebel/shared/util/arrays'
import { ChatMateError, InconsistentScopesError, InvalidAuthenticatedChannelError, PrimaryChannelNotFoundError } from '@rebel/shared/util/error'

type Deps = Dependencies<{
  logService: LogService
  youtubeAuthProvider: YoutubeAuthProvider
  youtubeApiProxyService: YoutubeApiProxyService
  channelId: string
  authStore: AuthStore
  streamerChannelStore: StreamerChannelStore
  authHelpers: AuthHelpers
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

  constructor (deps: Deps) {
    super()

    this.logService = deps.resolve('logService')
    this.youtubeAuthProvider = deps.resolve('youtubeAuthProvider')
    this.youtubeApiProxyService = deps.resolve('youtubeApiProxyService')
    this.youtubeAdminChannelId = deps.resolve('channelId')
    this.authStore = deps.resolve('authStore')
    this.streamerChannelStore = deps.resolve('streamerChannelStore')
    this.authHelpers = deps.resolve('authHelpers')
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
}
