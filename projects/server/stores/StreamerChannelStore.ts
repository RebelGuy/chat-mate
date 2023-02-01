import { ChatUser, StreamerTwitchChannelLink, StreamerYoutubeChannelLink } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { channelQuery_includeLatestChannelInfo, TwitchChannelWithLatestInfo, UserChannel, YoutubeChannelWithLatestInfo } from '@rebel/server/stores/ChannelStore'

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

  public async deleteStreamerYoutubeChannelLink (streamerId: number): Promise<UserChannel<'youtube'> | null> {
    const removedLink = await this.db.streamerYoutubeChannelLink.delete({
      where: { streamerId },
      include: { youtubeChannel: { include: channelQuery_includeLatestChannelInfo } }
    })

    return removedLink != null ? youtubeLinkToUserChannel(removedLink) : null
  }

  public async deleteStreamerTwitchChannelLink (streamerId: number): Promise<UserChannel<'twitch'> | null> {
    const removedLink = await this.db.streamerTwitchChannelLink.delete({
      where: { streamerId },
      include: { twitchChannel: { include: channelQuery_includeLatestChannelInfo } }
    })

    return removedLink != null ? twitchLinkToUserChannel(removedLink) : null
  }

  /** Returns the streamers' primary channels - the channels that were selected to be streamed on. */
  public async getPrimaryChannels (streamerIds: number[]): Promise<PrimaryChannels[]> {
    const youtubeLinks = await this.db.streamerYoutubeChannelLink.findMany({
      where: { streamerId: { in: streamerIds } },
      include: { youtubeChannel: { include: channelQuery_includeLatestChannelInfo } }
    })

    const twitchLinks = await this.db.streamerTwitchChannelLink.findMany({
      where: { streamerId: { in: streamerIds} },
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

  public async setStreamerYoutubeChannelLink (streamerId: number, youtubeChannelId: number): Promise<UserChannel<'youtube'>> {
    const addedLink = await this.db.streamerYoutubeChannelLink.create({
      data: { streamerId, youtubeChannelId },
      include: { youtubeChannel: { include: channelQuery_includeLatestChannelInfo } }
    })

    return youtubeLinkToUserChannel(addedLink)
  }

  public async setStreamerTwitchChannelLink (streamerId: number, twitchChannelId: number): Promise<UserChannel<'twitch'>> {
    const addedLink = await this.db.streamerTwitchChannelLink.create({
      data: { streamerId, twitchChannelId },
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
