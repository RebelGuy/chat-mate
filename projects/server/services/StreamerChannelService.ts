import { Streamer } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { getUserName } from '@rebel/server/services/ChannelService'
import LogService from '@rebel/server/services/LogService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { single, singleOrNull } from '@rebel/server/util/arrays'

export type TwitchStreamerChannel = {
  streamerId: number
  twitchChannelName: string
}

type Deps = Dependencies<{
  streamerStore: StreamerStore
  accountStore: AccountStore
  channelStore: ChannelStore
  logService: LogService
}>

export default class StreamerChannelService extends ContextClass {
  public readonly name = StreamerChannelService.name
  private readonly streamerStore: StreamerStore
  private readonly accountStore: AccountStore
  private readonly channelStore: ChannelStore
  private readonly logService: LogService

  constructor (deps: Deps) {
    super()
    this.streamerStore = deps.resolve('streamerStore')
    this.accountStore = deps.resolve('accountStore')
    this.channelStore = deps.resolve('channelStore')
    this.logService = deps.resolve('logService')
  }

  public async getAllTwitchStreamerChannels (): Promise<TwitchStreamerChannel[]> {
    const streamers = await this.streamerStore.getStreamers()
    // todo: this is not very scalable
    const channelResults = await Promise.allSettled(streamers.map(s => this.getTwitchChannelNameFromStreamer(s)))

    let streamerChannels: TwitchStreamerChannel[] = []
    for (let i = 0; i < channelResults.length; i++) {
      const result = channelResults[i]
      if (result.status === 'fulfilled' && result.value != null) {
        streamerChannels.push({ streamerId: streamers[i].id, twitchChannelName: result.value })
      }
    }

    return streamerChannels
  }

  /** Returns null when the associated chat user does not have a linked Twitch channel, or if any intermediate db object cannot be found. */
  public async getTwitchChannelName (streamerId: number): Promise<string | null> {
    const streamer = await this.streamerStore.getStreamerById(streamerId)
    if (streamer == null) {
      this.logService.logWarning(this, `Invalid streamer id ${streamerId}`)
      return null
    }

    return await this.getTwitchChannelNameFromStreamer(streamer)
  }

  private async getTwitchChannelNameFromStreamer (streamer: Streamer): Promise<string | null> {
    const registeredUser = singleOrNull(await this.accountStore.getRegisteredUsersFromIds([streamer.registeredUserId]))
    if (registeredUser == null) {
      this.logService.logWarning(this, `Invalid registered user id ${streamer.registeredUserId} for streamer ${streamer.id}`)
      return null
    }

    const channels = await this.channelStore.getConnectedUserOwnedChannels([registeredUser.aggregateChatUserId]).then(single)
    if (channels.twitchChannelIds.length === 0) {
      return null
    }

    const channelId = channels.twitchChannelIds[0]
    const channel = await this.channelStore.getTwitchChannelFromChannelId([channelId]).then(single)
    return getUserName(channel)
  }
}
