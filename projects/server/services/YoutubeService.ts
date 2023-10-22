import { YoutubeApiClientProvider } from '@rebel/server/providers/YoutubeApiClientProvider'
import YoutubeApiProxyService from '@rebel/server/services/YoutubeApiProxyService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { single } from '@rebel/shared/util/arrays'

type Deps = Dependencies<{
  youtubeApiClientProvider: YoutubeApiClientProvider
  streamerChannelStore: StreamerChannelStore
  channelStore: ChannelStore
  youtubeApiProxyService: YoutubeApiProxyService
}>

export default class YoutubeService extends ContextClass {
  private readonly youtubeApiClientProvider: YoutubeApiClientProvider
  private readonly streamerChannelStore: StreamerChannelStore
  private readonly channelStore: ChannelStore
  private readonly youtubeApiProxyService: YoutubeApiProxyService

  constructor (deps: Deps) {
    super()
    this.youtubeApiClientProvider = deps.resolve('youtubeApiClientProvider')
    this.streamerChannelStore = deps.resolve('streamerChannelStore')
    this.channelStore = deps.resolve('channelStore')
    this.youtubeApiProxyService = deps.resolve('youtubeApiProxyService')
  }

  public async getMods (streamerId: number) {
    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    const client = await this.youtubeApiClientProvider.getClientForStreamer(streamerExternalChannelId)

    // not sure if this is paginated or not... just gonna ignore for now
    const mods = await client.liveChatModerators.list()

    // todo: transform data into internal type
  }

  public async mod (streamerId: number, youtubeChannelId: number) {
    const streamerExternalChannelId = await this.getExternalChannelIdFromStreamer(streamerId)
    const userExternalChannelId = await this.getExtermalChannelIdFromInternalChannelId(youtubeChannelId)
    const result = await this.youtubeApiProxyService.mod(streamerExternalChannelId, userExternalChannelId)
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
