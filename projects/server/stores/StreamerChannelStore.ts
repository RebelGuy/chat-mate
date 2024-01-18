import { ChatUser, StreamerTwitchChannelLink, StreamerYoutubeChannelLink } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider, { Db, isKnownPrismaError } from '@rebel/server/providers/DbProvider'
import { channelQuery_includeLatestChannelInfo, TwitchChannelWithLatestInfo, UserChannel, YoutubeChannelWithLatestInfo } from '@rebel/server/stores/ChannelStore'
import { PrimaryChannelAlreadyExistsError, PrimaryChannelNotFoundError } from '@rebel/shared/util/error'

export type PrimaryChannels = {
  streamerId: number
  youtubeChannel: UserChannel<'youtube'> | null
  twitchChannel: UserChannel<'twitch'> | null
}

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class StreamerChannelStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
  }

  /** @throws {@link PrimaryChannelNotFoundError}: When no primary Youtube channel exists for the streamer. */
  public async removeStreamerYoutubeChannelLink (streamerId: number): Promise<UserChannel<'youtube'>> {
    const entry = await this.db.streamerYoutubeChannelLink.findFirst({ where: {
      streamerId: streamerId,
      timeRemoved: null
    }})

    if (entry == null) {
      throw new PrimaryChannelNotFoundError(streamerId, 'youtube')
    }

    const removedLink = await this.db.streamerYoutubeChannelLink.update({
      data: { timeRemoved: new Date() },
      where: { id: entry.id },
      include: { youtubeChannel: { include: channelQuery_includeLatestChannelInfo } }
    })
    return youtubeLinkToUserChannel(removedLink)
  }

  /** @throws {@link PrimaryChannelNotFoundError}: When no primary Twitch channel exists for the streamer. */
  public async removeStreamerTwitchChannelLink (streamerId: number): Promise<UserChannel<'twitch'>> {
    const entry = await this.db.streamerTwitchChannelLink.findFirst({ where: {
      streamerId: streamerId,
      timeRemoved: null
    }})

    if (entry == null) {
      throw new PrimaryChannelNotFoundError(streamerId, 'twitch')
    }

    const removedLink = await this.db.streamerTwitchChannelLink.update({
      data: { timeRemoved: new Date() },
      where: { id: entry.id },
      include: { twitchChannel: { include: channelQuery_includeLatestChannelInfo } }
    })
    return twitchLinkToUserChannel(removedLink)
  }

  /** Returns the streamers' primary channels - the channels that were selected to be streamed on. */
  public async getPrimaryChannels (streamerIds: number[]): Promise<PrimaryChannels[]> {
    const youtubeLinks = await this.db.streamerYoutubeChannelLink.findMany({
      where: {
        streamerId: { in: streamerIds },
        timeRemoved: null
      },
      include: { youtubeChannel: { include: channelQuery_includeLatestChannelInfo } }
    })

    const twitchLinks = await this.db.streamerTwitchChannelLink.findMany({
      where: {
        streamerId: { in: streamerIds},
        timeRemoved: null
      },
      include: { twitchChannel: { include: channelQuery_includeLatestChannelInfo } }
    })

    return streamerIds.map<PrimaryChannels>(streamerId => {
      const youtubeLink = youtubeLinks.find(l => l.streamerId === streamerId)
      const youtubeChannel = youtubeLink != null ? youtubeLinkToUserChannel(youtubeLink) : null

      const twitchLink = twitchLinks.find(l => l.streamerId === streamerId)
      const twitchChannel = twitchLink != null ? twitchLinkToUserChannel(twitchLink) : null

      return { streamerId, youtubeChannel, twitchChannel }
    })
  }

  /** @throws {@link PrimaryChannelAlreadyExistsError}: When a primary Youtube channel already exists for the streamer. */
  public async setStreamerYoutubeChannelLink (streamerId: number, youtubeChannelId: number): Promise<UserChannel<'youtube'>> {
    const existingLink = await this.db.streamerYoutubeChannelLink.findFirst({
      where: {
        streamerId: streamerId,
        timeRemoved: null
      }
    })

    if (existingLink != null) {
      throw new PrimaryChannelAlreadyExistsError(streamerId, 'youtube')
    }

    const addedLink = await this.db.streamerYoutubeChannelLink.create({
      data: {
        streamerId: streamerId,
        youtubeChannelId: youtubeChannelId,
        timeAdded: new Date()
      },
      include: { youtubeChannel: { include: channelQuery_includeLatestChannelInfo } }
    })

    return youtubeLinkToUserChannel(addedLink)
  }

  /** @throws {@link PrimaryChannelAlreadyExistsError}: When a primary Twitch channel already exists for the streamer. */
  public async setStreamerTwitchChannelLink (streamerId: number, twitchChannelId: number): Promise<UserChannel<'twitch'>> {
    const existingLink = await this.db.streamerTwitchChannelLink.findFirst({
      where: {
        streamerId: streamerId,
        timeRemoved: null
      }
    })

    if (existingLink != null) {
      throw new PrimaryChannelAlreadyExistsError(streamerId, 'twitch')
    }

    const addedLink = await this.db.streamerTwitchChannelLink.create({
      data: {
        streamerId: streamerId,
        twitchChannelId: twitchChannelId,
        timeAdded: new Date()
      },
      include: { twitchChannel: { include: channelQuery_includeLatestChannelInfo } }
    })

    return twitchLinkToUserChannel(addedLink)
  }
}

function youtubeLinkToUserChannel (youtubeLink: StreamerYoutubeChannelLink & { youtubeChannel: YoutubeChannelWithLatestInfo & { user: ChatUser }}): UserChannel<'youtube'> {
  return {
    aggregateUserId: youtubeLink.youtubeChannel.user.aggregateChatUserId,
    defaultUserId: youtubeLink.youtubeChannel.userId,
    platformInfo: { platform: 'youtube', channel: youtubeLink.youtubeChannel }
  }
}

function twitchLinkToUserChannel (twitchLink: StreamerTwitchChannelLink & { twitchChannel: TwitchChannelWithLatestInfo & { user: ChatUser }}): UserChannel<'twitch'> {
  return {
    aggregateUserId: twitchLink.twitchChannel.user.aggregateChatUserId,
    defaultUserId: twitchLink.twitchChannel.userId,
    platformInfo: { platform: 'twitch', channel: twitchLink.twitchChannel }
  }
}
