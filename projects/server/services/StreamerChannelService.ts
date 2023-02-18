import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import { getUserName } from '@rebel/server/services/ChannelService'
import EventDispatchService from '@rebel/server/services/EventDispatchService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { nonNull, single } from '@rebel/shared/util/arrays'
import { ForbiddenError } from '@rebel/shared/util/error'
import { assertUnreachable } from '@rebel/shared/util/typescript'

export type TwitchStreamerChannel = {
  streamerId: number
  twitchChannelName: string
}

type Deps = Dependencies<{
  streamerStore: StreamerStore
  streamerChannelStore: StreamerChannelStore
  eventDispatchService: EventDispatchService
  accountStore: AccountStore
  channelStore: ChannelStore
  livestreamStore: LivestreamStore
}>

export default class StreamerChannelService extends ContextClass {
  private readonly streamerStore: StreamerStore
  private readonly streamerChannelStore: StreamerChannelStore
  private readonly eventDispatchService: EventDispatchService
  private readonly channelStore: ChannelStore
  private readonly accountStore: AccountStore
  private readonly livestreamStore: LivestreamStore

  constructor (deps: Deps) {
    super()
    this.streamerStore = deps.resolve('streamerStore')
    this.streamerChannelStore = deps.resolve('streamerChannelStore')
    this.eventDispatchService = deps.resolve('eventDispatchService')
    this.channelStore = deps.resolve('channelStore')
    this.accountStore = deps.resolve('accountStore')
    this.livestreamStore = deps.resolve('livestreamStore')
  }

  /** Gets the list of all streamers and their primary Twitch channel's name, for those that have a primary Twitch channel set.  */
  public async getAllTwitchStreamerChannels (): Promise<TwitchStreamerChannel[]> {
    const streamers = await this.streamerStore.getStreamers()
    const primaryChannels = await this.streamerChannelStore.getPrimaryChannels(streamers.map(s => s.id))
    return nonNull(primaryChannels.map(c => c.twitchChannel != null ? { streamerId: c.streamerId, twitchChannelName: getUserName(c.twitchChannel) } : null))
  }

  /** Returns null when the streamer does not have a primary twitch channel. */
  public async getTwitchChannelName (streamerId: number): Promise<string | null> {
    const primaryChannels = await this.streamerChannelStore.getPrimaryChannels([streamerId]).then(single)
    return primaryChannels?.twitchChannel != null ? getUserName(primaryChannels.twitchChannel) : null
  }

  /** Sets the provided channel to be the streamer's primary youtube or twitch channel.
   * @throws {@link ForbiddenError}: When the streamer is not linked to the youtube or twitch channel.
  */
  public async setPrimaryChannel (streamerId: number, platform: 'youtube' | 'twitch', youtubeOrTwitchChannelId: number) {
    const activeLivestream = await this.livestreamStore.getActiveLivestream(streamerId)
    if (activeLivestream != null) {
      throw new Error('Cannot set the primary channel because a livestream is currently active or in progress. Please deactivate the livestream or try again later.')
    }

    const streamer = await this.streamerStore.getStreamerById(streamerId)
    const registeredUser = await this.accountStore.getRegisteredUsersFromIds([streamer!.registeredUserId]).then(single)
    const userOwnedChannels = await this.channelStore.getConnectedUserOwnedChannels([registeredUser.aggregateChatUserId]).then(single)

    let userChannel: UserChannel
    if (platform === 'youtube') {
      if (!userOwnedChannels.youtubeChannelIds.includes(youtubeOrTwitchChannelId)) {
        throw new ForbiddenError(`Streamer ${streamerId} does not have access to YouTube channel ${youtubeOrTwitchChannelId}.`)
      }
      userChannel = await this.streamerChannelStore.setStreamerYoutubeChannelLink(streamerId, youtubeOrTwitchChannelId)

    } else if (platform === 'twitch') {
      if (!userOwnedChannels.twitchChannelIds.includes(youtubeOrTwitchChannelId)) {
        throw new ForbiddenError(`Streamer ${streamerId} does not have access to Twitch channel ${youtubeOrTwitchChannelId}.`)
      }
      userChannel = await this.streamerChannelStore.setStreamerTwitchChannelLink(streamerId, youtubeOrTwitchChannelId)

    } else {
      assertUnreachable(platform)
    }

    await this.eventDispatchService.addData('addPrimaryChannel', { streamerId, userChannel })
  }

  public async unsetPrimaryChannel (streamerId: number, platform: 'youtube' | 'twitch') {
    const activeLivestream = await this.livestreamStore.getActiveLivestream(streamerId)
    if (activeLivestream != null) {
      throw new Error('Cannot unset the primary channel because a livestream is currently in progress. Please try again later.')
    }

    let userChannel: UserChannel | null
    if (platform === 'youtube') {
      userChannel = await this.streamerChannelStore.deleteStreamerYoutubeChannelLink(streamerId)
    } else if (platform === 'twitch') {
      userChannel = await this.streamerChannelStore.deleteStreamerTwitchChannelLink(streamerId)
    } else {
      assertUnreachable(platform)
    }

    if (userChannel != null) {
      await this.eventDispatchService.addData('removePrimaryChannel', { streamerId, userChannel })
    }
  }
}
