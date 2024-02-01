import LogService from '@rebel/server/services/LogService'
import YoutubeApiProxyService from '@rebel/server/services/YoutubeApiProxyService'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { single } from '@rebel/shared/util/arrays'
import { ChatMateError } from '@rebel/shared/util/error'

type YoutubeMod = {
  externalChannelId: string
  externalModId: string
  channelId: number | null // null if the user can't be matched to a ChatMate user
}

type Deps = Dependencies<{
  streamerChannelStore: StreamerChannelStore
  channelStore: ChannelStore
  youtubeApiProxyService: YoutubeApiProxyService
  livestreamStore: LivestreamStore
  logService: LogService
}>

export default class YoutubeService extends ContextClass {
  public readonly name = YoutubeService.name

  private readonly streamerChannelStore: StreamerChannelStore
  private readonly channelStore: ChannelStore
  private readonly youtubeApiProxyService: YoutubeApiProxyService
  private readonly livestreamStore: LivestreamStore
  private readonly logService: LogService

  constructor (deps: Deps) {
    super()
    this.streamerChannelStore = deps.resolve('streamerChannelStore')
    this.channelStore = deps.resolve('channelStore')
    this.youtubeApiProxyService = deps.resolve('youtubeApiProxyService')
    this.livestreamStore = deps.resolve('livestreamStore')
    this.logService = deps.resolve('logService')
  }

  public async getMods (streamerId: number): Promise<YoutubeMod[]> {
    const livestream = await this.livestreamStore.getActiveYoutubeLivestream(streamerId)
    if (livestream == null) {
      throw new ChatMateError(`Cannot get moderators because streamer ${streamerId} has no active livestream.`)
    }

    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    const mods = await this.youtubeApiProxyService.getMods(streamerId, streamerExternalChannelId, livestream.liveId)

    const allChannels: UserChannel<'youtube'>[] = await this.channelStore.getAllChannels(streamerId)
      .then(channels => channels.filter(c => c.platformInfo.platform === 'youtube'))

    return mods.map(mod => ({
      externalChannelId: mod.externalChannelId,
      channelId: allChannels.find(c => c.platformInfo.channel.youtubeId === mod.externalChannelId)?.platformInfo.channel.id ?? null,
      externalModId: mod.externalModId
    }))
  }

  public async modYoutubeChannel (streamerId: number, youtubeChannelId: number) {
    const livestream = await this.livestreamStore.getActiveYoutubeLivestream(streamerId)
    if (livestream == null) {
      throw new ChatMateError(`Cannot add moderator ${youtubeChannelId} because streamer ${streamerId} has no active livestream.`)
    }

    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    const userExternalChannelId = await this.getExternalChannelIdFromInternalChannelId(youtubeChannelId)
    const externalModeratorId = await this.youtubeApiProxyService.mod(streamerId, streamerExternalChannelId, userExternalChannelId, livestream.liveId)
    this.logService.logInfo(this, `Successfully modded youtube channel ${youtubeChannelId} for streamer ${streamerId} (externalModeratorId: ${externalModeratorId})`)
  }

  public async unmodYoutubeChannel (streamerId: number, youtubeChannelId: number) {
    const allMods = await this.getMods(streamerId)
    const externalModeratorId = allMods.find(m => m.channelId === youtubeChannelId)?.externalModId
    if (externalModeratorId == null) {
      this.logService.logWarning(this, `Cannot unmod channel ${youtubeChannelId} for streamer ${streamerId} because the channel is not modded.`)
      return
    }

    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    await this.youtubeApiProxyService.unmod(streamerId, streamerExternalChannelId, externalModeratorId)
    this.logService.logInfo(this, `Successfully unmodded youtube channel ${youtubeChannelId} for streamer ${streamerId} (externalModeratorId: ${externalModeratorId})`)
  }

  public async banYoutubeChannel (streamerId: number, youtubeChannelId: number) {
    const livestream = await this.livestreamStore.getActiveYoutubeLivestream(streamerId)
    if (livestream == null) {
      throw new ChatMateError(`Cannot ban channel ${youtubeChannelId} because streamer ${streamerId} has no active livestream.`)
    }

    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    const userExternalChannelId = await this.getExternalChannelIdFromInternalChannelId(youtubeChannelId)
    const externalBanId = await this.youtubeApiProxyService.ban(streamerId, streamerExternalChannelId, userExternalChannelId, livestream.liveId)
    this.logService.logInfo(this, `Successfully banned youtube channel ${youtubeChannelId} for streamer ${streamerId} (externalBanId: ${externalBanId})`)
  }

  public async timeoutYoutubeChannel (streamerId: number, youtubeChannelId: number, durationSeconds: number) {
    const livestream = await this.livestreamStore.getActiveYoutubeLivestream(streamerId)
    if (livestream == null) {
      throw new ChatMateError(`Cannot timeout channel ${youtubeChannelId} for ${durationSeconds} seconds because streamer ${streamerId} has no active livestream.`)
    }

    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    const userExternalChannelId = await this.getExternalChannelIdFromInternalChannelId(youtubeChannelId)
    const externalTimeoutId = await this.youtubeApiProxyService.timeout(streamerId, streamerExternalChannelId, userExternalChannelId, livestream.liveId, durationSeconds)
    this.logService.logInfo(this, `Successfully timed out youtube channel ${youtubeChannelId} for streamer ${streamerId} for ${durationSeconds} seconds (externalTimeoutId: ${externalTimeoutId})`)
  }

  public async unbanYoutubeChannel (streamerId: number, youtubeChannelId: number) {
    const livestream = await this.livestreamStore.getActiveYoutubeLivestream(streamerId)
    if (livestream == null) {
      throw new ChatMateError(`Cannot timeout channel ${youtubeChannelId} because streamer ${streamerId} has no active livestream.`)
    }

    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    const userExternalChannelId = await this.getExternalChannelIdFromInternalChannelId(youtubeChannelId)
    const externalBanId = this.constructExternalBanId(streamerExternalChannelId, userExternalChannelId, livestream.liveId)

    await this.youtubeApiProxyService.unban(streamerId, streamerExternalChannelId, externalBanId)
    this.logService.logInfo(this, `Successfully unbanned youtube channel ${youtubeChannelId} for streamer ${streamerId} (generated externalBanId: ${externalBanId})`)
  }

  public async untimeoutYoutubeChannel (streamerId: number, youtubeChannelId: number) {
    // seems that it is not possible to remove a timeout using the API (lol). an alternative method is to apply a 0-second timeout
    await this.timeoutYoutubeChannel(streamerId, youtubeChannelId, 0)
    this.logService.logInfo(this, `Successfully removed timeout of youtube channel ${youtubeChannelId} for streamer ${streamerId}`)
  }

  private async getExternalChannelIdFromStreamer (streamerId: number) {
    const primaryChannels = await this.streamerChannelStore.getPrimaryChannels([streamerId]).then(single)
    const youtubeChannel = primaryChannels.youtubeChannel
    if (youtubeChannel == null) {
      throw new ChatMateError(`Streamer ${streamerId} does not have a primary YouTube channel.`)
    }

    return youtubeChannel.platformInfo.channel.youtubeId
  }

  private async getExternalChannelIdFromInternalChannelId (internalChannelId: number) {
    const userChannel = await this.channelStore.getYoutubeChannelsFromChannelIds([internalChannelId]).then(single)
    return userChannel.platformInfo.channel.youtubeId
  }

  private constructExternalBanId (streamerExternalChannelId: string, userExternalChannelId: string, liveId: string) {
    // when applying a ban, we get back an external ban id. it is expected that we pass this id when unbanning a user.
    // however, in the common case where we did not use the api to ban the user, we have no way of querying current bans to get the id.
    // turns out, the id is just base64 encoded and can be deterministically generated by us!
    // absolute legend https://stackoverflow.com/a/69802935
    const utf8String = `\x08\x01\x12\x18${userExternalChannelId}\x1a8\n\r\n\x0b${liveId}*'\n\x18${streamerExternalChannelId}\x12\x0b${liveId}`
    const base64String = Buffer.from(utf8String, 'utf-8').toString('base64')
    return encodeURIComponent(base64String)
  }
}
