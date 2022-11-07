import { Streamer } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import LogService from '@rebel/server/services/LogService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'

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

  public async getAllTwitchChannelNames (): Promise<string[]> {
    const streamers = await this.streamerStore.getStreamers()
    // todo: this is not very scalable
    const channelResults = await Promise.allSettled(streamers.map(s => this.getTwitchChannelNameFromStreamer(s)))
    const channels = channelResults.filter(r => r.status === 'fulfilled' && r.value != null).map(r => (r as PromiseFulfilledResult<string>).value)
    return channels
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
    const registeredUser = await this.accountStore.getRegisteredUserFromId(streamer.registeredUserId)
    if (registeredUser == null) {
      this.logService.logWarning(this, `Invalid registered user id ${streamer.registeredUserId} for streamer ${streamer.id}`)
      return null
    }

    if (registeredUser.chatUserId == null) {
      this.logService.logWarning(this, `The streamer ${streamer.id} is not linked to a chat user`)
      return null
    }

    const channels = await this.channelStore.getUserOwnedChannels(registeredUser.chatUserId)
    if (channels.twitchChannels.length === 0) {
      this.logService.logWarning(this, `No twitch channels exist for streamer ${streamer.id}`)
      return null
    }

    const channelId = channels.twitchChannels[0]
    return await this.channelStore.getTwitchUserNameFromChannelId(channelId)
  }
}