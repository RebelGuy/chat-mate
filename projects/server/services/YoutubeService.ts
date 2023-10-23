import YoutubeApiProxyService from '@rebel/server/services/YoutubeApiProxyService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { single } from '@rebel/shared/util/arrays'

type Deps = Dependencies<{
  streamerChannelStore: StreamerChannelStore
  channelStore: ChannelStore
  youtubeApiProxyService: YoutubeApiProxyService
  livestreamStore: LivestreamStore
}>

export default class YoutubeService extends ContextClass {
  private readonly streamerChannelStore: StreamerChannelStore
  private readonly channelStore: ChannelStore
  private readonly youtubeApiProxyService: YoutubeApiProxyService
  private readonly livestreamStore: LivestreamStore

  constructor (deps: Deps) {
    super()
    this.streamerChannelStore = deps.resolve('streamerChannelStore')
    this.channelStore = deps.resolve('channelStore')
    this.youtubeApiProxyService = deps.resolve('youtubeApiProxyService')
    this.livestreamStore = deps.resolve('livestreamStore')
  }

  public async getMods (streamerId: number) {
    const livestream = await this.livestreamStore.getActiveLivestream(streamerId)
    if (livestream == null) {
      throw new Error(`Cannot get moderators because streamer ${streamerId} has no active livestream.`)
    }

    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    const mods = await this.youtubeApiProxyService.getMods(streamerExternalChannelId, livestream.liveId)

    // todo: attach internal ids to items
  }

  public async mod (streamerId: number, youtubeChannelId: number) {
    const livestream = await this.livestreamStore.getActiveLivestream(streamerId)
    if (livestream == null) {
      throw new Error(`Cannot add moderator ${youtubeChannelId} because streamer ${streamerId} has no active livestream.`)
    }

    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    const userExternalChannelId = await this.getExtermalChannelIdFromInternalChannelId(youtubeChannelId)
    const externalModeratorId = await this.youtubeApiProxyService.mod(streamerExternalChannelId, userExternalChannelId, livestream.liveId)
    // todo: store externalModeratorId
  }

  public async unmod (streamerId: number, youtubeChannelId: number) {
    // todo: get external id
    const externalModId = ''
    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    await this.youtubeApiProxyService.unmod(streamerExternalChannelId, externalModId)
    // todo: remove externalModeratorId
  }

  public async ban (streamerId: number, youtubeChannelId: number) {
    const livestream = await this.livestreamStore.getActiveLivestream(streamerId)
    if (livestream == null) {
      throw new Error(`Cannot ban channel ${youtubeChannelId} because streamer ${streamerId} has no active livestream.`)
    }

    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    const userExternalChannelId = await this.getExtermalChannelIdFromInternalChannelId(youtubeChannelId)
    const externalBanId = await this.youtubeApiProxyService.ban(streamerExternalChannelId, userExternalChannelId, livestream.liveId)
    // todo: store externalBanId
  }

  public async timeout (streamerId: number, youtubeChannelId: number, durationSeconds: number) {
    const livestream = await this.livestreamStore.getActiveLivestream(streamerId)
    if (livestream == null) {
      throw new Error(`Cannot timeout channel ${youtubeChannelId} because streamer ${streamerId} has no active livestream.`)
    }

    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    const userExternalChannelId = await this.getExtermalChannelIdFromInternalChannelId(youtubeChannelId)
    const externalTimeoutId = await this.youtubeApiProxyService.timeout(streamerExternalChannelId, userExternalChannelId, livestream.liveId, durationSeconds)
    // todo: store externalTimeoutId
  }

  public async unban (streamerId: number, youtubeChannelId: number) {
    // todo: get externalPunishmentId
    const externalPunishmentId = ''
    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    await this.youtubeApiProxyService.unbanOrUntimeout(streamerExternalChannelId, externalPunishmentId)
    // todo: remove externalPunishmentId
  }

  public async untimeout (streamerId: number, youtubeChannelId: number) {
    // todo: get externalPunishmentId
    const externalPunishmentId = ''
    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    await this.youtubeApiProxyService.unbanOrUntimeout(streamerExternalChannelId, externalPunishmentId)
    // todo: remove externalPunishmentId
  }

  private async getExternalChannelIdFromStreamer (streamerId: number) {
    const primaryChannels = await this.streamerChannelStore.getPrimaryChannels([streamerId]).then(single)
    const youtubeChannel = primaryChannels.youtubeChannel
    if (youtubeChannel == null) {
      throw new Error(`Streamer ${streamerId} does not have a primary YouTube channel.`)
    }

    return youtubeChannel.platformInfo.channel.youtubeId
  }

  private async getExtermalChannelIdFromInternalChannelId (internalChannelId: number) {
    const userChannel = await this.channelStore.getYoutubeChannelFromChannelId([internalChannelId]).then(single)
    return userChannel.platformInfo.channel.youtubeId
  }
}
