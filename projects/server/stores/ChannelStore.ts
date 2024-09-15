import { YoutubeChannelGlobalInfo, Prisma, TwitchChannelGlobalInfo, TwitchChannel, YoutubeChannel, YoutubeChannelStreamerInfo, TwitchChannelStreamerInfo } from '@prisma/client'
import { nonNull } from '@rebel/shared/util/arrays'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import { ChatPlatform } from '@rebel/server/models/chat'
import { New, Entity } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { SafeOmit } from '@rebel/shared/types'
import { SafeExtract } from '@rebel/shared/types'
import { ChatMateError } from '@rebel/shared/util/error'
import { ImageInfo } from '@rebel/server/services/ImageService'
import { randomString } from '@rebel/shared/util/random'

export type CreateOrUpdateGlobalYoutubeChannelArgs = SafeOmit<New<YoutubeChannelGlobalInfo>, 'channelId'>
export type CreateOrUpdateGlobalTwitchChannelArgs = SafeOmit<New<TwitchChannelGlobalInfo>, 'channelId'>

export type CreateOrUpdateStreamerYoutubeChannelArgs = SafeOmit<New<YoutubeChannelStreamerInfo>, 'channelId'>
export type CreateOrUpdateStreamerTwitchChannelArgs = SafeOmit<New<TwitchChannelStreamerInfo>, 'channelId'>

export type CreateOrUpdateYoutubeChannelArgs = SafeOmit<CreateOrUpdateGlobalYoutubeChannelArgs, 'imageId'> & CreateOrUpdateStreamerYoutubeChannelArgs
export type CreateOrUpdateTwitchChannelArgs = CreateOrUpdateGlobalTwitchChannelArgs & CreateOrUpdateStreamerTwitchChannelArgs

export type YoutubeChannelWithLatestInfo = SafeOmit<Entity.YoutubeChannel, 'chatMessages' | 'user' | 'streamerYoutubeChannelLinks' | 'streamerInfoHistory'>
export type TwitchChannelWithLatestInfo = SafeOmit<Entity.TwitchChannel, 'chatMessages' | 'user' | 'streamerTwitchChannelLinks' | 'streamerInfoHistory'>

/** Contains all channels on all platforms owned by the user. */
export type UserOwnedChannels = {
  /** The user for which we are querying owned channels. */
  userId: number,
  /** The aggregate user to which the queried user is attached. If the queried user is an aggregate user, they are the same value. */
  aggregateUserId: number | null
  youtubeChannelIds: number[],
  twitchChannelIds: number[]
}

// these generics feel good
export type UserChannel<TPlatform extends 'youtube' | 'twitch' = 'youtube' | 'twitch'> = {
  defaultUserId: number
  aggregateUserId: number | null
  platformInfo: (TPlatform extends 'youtube' ? {
    platform: SafeExtract<ChatPlatform, 'youtube'>
    channel: YoutubeChannelWithLatestInfo
  } : never) | (TPlatform extends 'twitch' ? {
    platform: SafeExtract<ChatPlatform, 'twitch'>
    channel: TwitchChannelWithLatestInfo
  } : never)
}

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class ChannelStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
  }

  public async createYoutubeChannel (
    externalId: string,
    channelInfo: CreateOrUpdateYoutubeChannelArgs,
    onGetImageInfo: (channelId: number, channelGlobalInfoId: number) => Promise<ImageInfo>
  ): Promise<YoutubeChannelWithLatestInfo> {
    // create the channel
    const channel = await this.db.youtubeChannel.create({
      data: {
        youtubeId: externalId,
        user: { create: {}},
        globalInfoHistory: { create: {
          time: channelInfo.time,
          name: channelInfo.name,
          imageUrl: channelInfo.imageUrl,
          isVerified: channelInfo.isVerified,
          image: { create: {
            fingerprint: getYoutubeChannelImageFingerprint(`youtube/TEMP-${randomString(12)}`),
            url: 'TEMP',
            width: 0,
            height: 0
          }}
        }},
        streamerInfoHistory: { create: { streamerId: channelInfo.streamerId, time: channelInfo.time, isOwner: channelInfo.isOwner, isModerator: channelInfo.isModerator } }
      },
      include: channelQuery_includeLatestChannelInfo
    })

    // create the image
    const globalInfo = channel.globalInfoHistory[0]
    const imageInfo = await onGetImageInfo(channel.id, globalInfo.id)
    await this.db.image.update({
      where: { id: globalInfo.imageId },
      data: {
        fingerprint: getYoutubeChannelImageFingerprint(globalInfo.imageUrl),
        url: imageInfo.relativeImageUrl,
        originalUrl: globalInfo.imageUrl,
        width: imageInfo.imageWidth,
        height: imageInfo.imageHeight
      }
    })

    return channel
  }

  public async createTwitchChannel (externalId: string, channelInfo: CreateOrUpdateTwitchChannelArgs): Promise<TwitchChannelWithLatestInfo> {
    return await this.db.twitchChannel.create({
      data: {
        twitchId: externalId,
        user: { create: {}},
        globalInfoHistory: { create: { time: channelInfo.time, userName: channelInfo.userName, displayName: channelInfo.displayName, userType: channelInfo.userType, colour: channelInfo.colour } },
        streamerInfoHistory: { create: { streamerId: channelInfo.streamerId, time: channelInfo.time, isBroadcaster: channelInfo.isBroadcaster, isMod: channelInfo.isMod, isSubscriber: channelInfo.isSubscriber, isVip: channelInfo.isVip } }
      },
      include: channelQuery_includeLatestChannelInfo
    })
  }

  public async getYoutubeChannelCount (since: number): Promise<number> {
    return await this.db.youtubeChannel.count({ where: {
      // if any global info is recorded before the since date, it means the channel is older than the since date so we shouldn't include it
      globalInfoHistory: { none: { time: { lt: new Date(since) } }}
    }})
  }

  public async getTwitchChannelCount (since: number): Promise<number> {
    return await this.db.twitchChannel.count({ where: {
      // if any global info is recorded before the since date, it means the channel is older than the since date so we shouldn't include it
      globalInfoHistory: { none: { time: { lt: new Date(since) } }}
    }})
  }

  /** Returns channels that have authored chat messages for the given streamer. */
  public async getAllChannels (streamerId: number): Promise<UserChannel[]> {
    const currentYoutubeChannelGlobalInfos = await this.db.youtubeChannelGlobalInfo.findMany({
      distinct: ['channelId'],
      orderBy: { time: 'desc' },
      include: { channel: { include: { user: true }}},
      where: { channel: { chatMessages: { some: { streamerId }}}} // omfg that works?!
    })
    const youtubeChannels = currentYoutubeChannelGlobalInfos.map<UserChannel>(info => ({
      defaultUserId: info.channel.userId,
      aggregateUserId: info.channel.user.aggregateChatUserId,
      platformInfo: {
        platform: 'youtube',
        channel: { id: info.channel.id, youtubeId: info.channel.youtubeId, userId: info.channel.userId, globalInfoHistory: [info] }
      }
    }))

    const currentTwitchChannelGlobalInfos = await this.db.twitchChannelGlobalInfo.findMany({
      distinct: ['channelId'],
      orderBy: { time: 'desc' },
      include: { channel: { include: { user: true }}},
      where: { channel: { chatMessages: { some: { streamerId }}}}
    })
    const twitchChannels = currentTwitchChannelGlobalInfos.map<UserChannel>(info => ({
      defaultUserId: info.channel.userId,
      aggregateUserId: info.channel.user.aggregateChatUserId,
      platformInfo: {
        platform: 'twitch',
        channel: { id: info.channel.id, twitchId: info.channel.twitchId, userId: info.channel.userId, globalInfoHistory: [info] }
      }
    }))

    return [...youtubeChannels, ...twitchChannels]
  }

  /** For each of the given internal twitch ids, returns the latest channel info. Throws if any channels could not be found. */
  public async getTwitchChannelsFromChannelIds (twitchChannelIds: number[]): Promise<UserChannel<'twitch'>[]> {
    if (twitchChannelIds.length === 0) {
      return []
    }

    const channels = await this.db.twitchChannel.findMany({
      where: { id: { in: twitchChannelIds } },
      include: channelQuery_includeLatestChannelInfo
    })

    return twitchChannelIds.map<UserChannel>(channelId => {
      const channel = channels.find(c => c.id === channelId)
      if (channel == null) {
        throw new ChatMateError(`Unable to find TwitchChannel with id ${channelId}`)
      }

      return {
        defaultUserId: channel.userId,
        aggregateUserId: channel.user.aggregateChatUserId,
        platformInfo: { platform: 'twitch', channel: channel }
      }
    })
  }

  /** For each of the given internal youtube ids, returns the latest channel info. Throws if any channels could not be found. */
  public async getYoutubeChannelsFromChannelIds (youtubeChannelIds: number[]): Promise<UserChannel<'youtube'>[]> {
    if (youtubeChannelIds.length === 0) {
      return []
    }

    const channels = await this.db.youtubeChannel.findMany({
      where: { id: { in: youtubeChannelIds } },
      include: channelQuery_includeLatestChannelInfo
    })

    return youtubeChannelIds.map<UserChannel>(channelId => {
      const channel = channels.find(c => c.id === channelId)
      if (channel == null) {
        throw new ChatMateError(`Unable to find YoutubeChannel with id ${channelId}`)
      }

      return {
        defaultUserId: channel.userId,
        aggregateUserId: channel.user.aggregateChatUserId,
        platformInfo: { platform: 'youtube', channel: channel }
      }
    })
  }

  /** Gets the latest N history updates (or less, if less exist) of the Youtube channel in the context of the streamer, sorted by time in descending order.
   * The data is updated only when the user posts a chat message in the streamer's chat, and if the streamer-specific channel details have changed. */
  public async getYoutubeChannelHistoryForStreamer (streamerId: number, youtubeChannelId: number, n: number): Promise<YoutubeChannelStreamerInfo[]> {
    return await this.db.youtubeChannelStreamerInfo.findMany({
      where: {
        channelId: youtubeChannelId,
        streamerId: streamerId
      },
      orderBy: { time: 'desc' },
      take: n
    })
  }

  /** Gets the latest N history updates (or less, if less exist) of the Twitch channel in the context of the streamer, sorted by time in descending order.
   * The data is updated only when the user posts a chat message in the streamer's chat, and if the streamer-specific channel details have changed. */
  public async getTwitchChannelHistoryForStreamer (streamerId: number, twitchChannelId: number, n: number): Promise<TwitchChannelStreamerInfo[]> {
    return await this.db.twitchChannelStreamerInfo.findMany({
      where: {
        channelId: twitchChannelId,
        streamerId: streamerId
      },
      orderBy: { time: 'desc' },
      take: n
    })
  }

  /** Returns null if the channel was not found. Not case sensitive. Do NOT provide the twitch external id - provide the twitch username instead. */
  public async getChannelFromUserNameOrExternalId (externalIdOrUserName: string): Promise<YoutubeChannel | TwitchChannel | null> {
    const youtubeChannel = await this.db.youtubeChannel.findUnique({ where: { youtubeId: externalIdOrUserName } })
    if (youtubeChannel != null) {
      return youtubeChannel
    }

    const twitchChannel = await this.db.twitchChannelGlobalInfo.findFirst({
      where: { userName: externalIdOrUserName },
      include: { channel: true }
    })
    return twitchChannel?.channel ?? null
  }

  /** Gets the primary userId that is associated with the channel that has the given external id. Throws if none is found. */
  public async getPrimaryUserId (externalId: string): Promise<number> {
    const youtubeChannel = await this.db.youtubeChannel.findUnique({ where: { youtubeId: externalId } })
    if (youtubeChannel != null) {
      return await this.getPrimaryUserIdForUser(youtubeChannel.userId)
    }

    const twitchChannel = await this.db.twitchChannel.findUnique({ where: { twitchId: externalId } })
    if (twitchChannel != null) {
      return await this.getPrimaryUserIdForUser(twitchChannel.userId)
    }

    throw new ChatMateError('Cannot find user with external id ' + externalId)
  }

  /** Returns the ordered channels associated with the chat user.
   * The chat user can either be a default user, or aggregate user, but all channels connected directly or indirectly to the user will be returned.
   * Throws if any of the users cannot be found. */
  public async getConnectedUserOwnedChannels (anyUserIds: number[]): Promise<UserOwnedChannels[]> {
    const registeredUsers = await this.db.registeredUser.findMany({ where: { aggregateChatUserId: { in: anyUserIds } }})

    const aggregateUserIds = registeredUsers.map(ru => ru.aggregateChatUserId)
    const userOwnedChannels1 = await this.getAggregateUserOwnedChannels(aggregateUserIds)

    const defaultUserIds = anyUserIds.filter(id => !aggregateUserIds.includes(id))
    const userOwnedChannels2 = await this.getDefaultUserOwnedChannelsWithLinks(defaultUserIds)

    const userOwnedChannels = [...userOwnedChannels1, ...userOwnedChannels2]

    return anyUserIds.map(id => {
      const channels = userOwnedChannels.find(c => c.userId === id)
      if (channels == null) {
        throw new ChatMateError(`Could not find connected channels for user ${id}`)
      } else {
        return channels
      }
    })
  }

  /** Like `getConnectedUserOwnedChannels`, but returns only the channels for the default user, ignoring any connected users.
   * Throws if any of the requested default users could not be found.
  */
  public async getDefaultUserOwnedChannels (defaultUserIds: number[]): Promise<UserOwnedChannels[]> {
    const results = await this.db.chatUser.findMany({
      where: {
        id: { in: defaultUserIds },
        registeredUser: null
      },
      include: {
        youtubeChannel: { select: { id: true }},
        twitchChannel: { select: { id: true }}
      },
    })

    return defaultUserIds.map<UserOwnedChannels>(id => {
      const result = results.find(r => r.id === id)
      if (result == null) {
        throw new ChatMateError(`Could not find default user ${id}`)
      }

      return {
        userId: id,
        aggregateUserId: result.aggregateChatUserId,
        youtubeChannelIds: nonNull([result.youtubeChannel?.id ?? null]),
        twitchChannelIds: nonNull([result.twitchChannel?.id ?? null])
      }
    })
  }

  /** Returns either only the default user's channels if not linked, or the channels of all linked users.
   * This method will ensure that the `userId` of each returned item corresponds to the requested user id (e.g. it is **NOT** replaced by an aggregate user id).
  */
  private async getDefaultUserOwnedChannelsWithLinks (defaultUserIds: number[]): Promise<UserOwnedChannels[]> {
    if (defaultUserIds.length === 0) {
      return []
    }

    // check if linked
    const linkedUsers = await this.db.chatUser.findMany({ where: {
      id: { in: defaultUserIds },
      aggregateChatUserId: { not: null }
    }})
    const aggregateUserIds = linkedUsers.map(user => user.aggregateChatUserId!)
    const aggregateChannels = await this.getAggregateUserOwnedChannels(aggregateUserIds)

    // the `userId` should be for the default user, NOT the aggregate user
    let aggregateChannelsRerouted: UserOwnedChannels[] = []
    for (const aggregateChannel of aggregateChannels) {
      // it is possible that multiple queried user ids reference the same aggregate channel. our results should include each queried user once with no duplicates
      const allIds = linkedUsers.filter(user => user.aggregateChatUserId === aggregateChannel.aggregateUserId).map(user => user.id)
      const usedIds = aggregateChannelsRerouted.filter(c => c.aggregateUserId === aggregateChannel.aggregateUserId).map(c => c.userId)
      const thisId = allIds.find(id => !usedIds.includes(id))!
      aggregateChannelsRerouted.push({ ...aggregateChannel, userId: thisId })
    }

    const linkedUserIds = linkedUsers.map(user => user.id)
    const unlinkedUserIds = defaultUserIds.filter(id => !linkedUserIds.includes(id))
    const standaloneChannels = await this.getDefaultUserOwnedChannels(unlinkedUserIds)

    return [...aggregateChannelsRerouted, ...standaloneChannels]
  }

  /** Returns all user channels connected to this aggregate user. */
  private async getAggregateUserOwnedChannels (aggregateChatUserIds: number[]): Promise<UserOwnedChannels[]> {
    if (aggregateChatUserIds.length === 0) {
      return []
    }

    const defaultUsers = await this.db.chatUser.findMany({
      where: { aggregateChatUserId: { in: aggregateChatUserIds } },
      include: {
        youtubeChannel: { select: { id: true }},
        twitchChannel: { select: { id: true }}
      },
    })

    return aggregateChatUserIds.map<UserOwnedChannels>(aggregateChatUserId => ({
      userId: aggregateChatUserId,
      aggregateUserId: aggregateChatUserId,
      youtubeChannelIds: nonNull(defaultUsers.filter(u => u.aggregateChatUserId === aggregateChatUserId).map(u => u.youtubeChannel?.id ?? null)),
      twitchChannelIds: nonNull(defaultUsers.filter(u => u.aggregateChatUserId === aggregateChatUserId).map(u => u.twitchChannel?.id ?? null))
    }))
  }

  /** Returns the same userId if the chat user is a default user, otherwise returns the id of the attached aggregate user. */
  private async getPrimaryUserIdForUser (anyUserId: number) {
    const chatUser = await this.db.chatUser.findFirst({
      where: { id: anyUserId },
      include: { registeredUser: true, aggregateChatUser: true }
    })

    if (chatUser!.registeredUser != null) {
      // is an aggregate user
      return anyUserId
    } else if (chatUser!.aggregateChatUserId != null) {
      // is linked to an aggreate user
      return chatUser!.aggregateChatUserId
    } else {
      // is a default user
      return anyUserId
    }
  }

  public async tryGetYoutubeChannelWithLatestInfo (youtubeChannelId: string): Promise<YoutubeChannelWithLatestInfo | null> {
    return await this.db.youtubeChannel.findUnique({
      where: { youtubeId: youtubeChannelId },
      include: channelQuery_includeLatestChannelInfo
    })
  }

  public async tryGetTwitchChannelWithLatestInfo (twitchChannelId: string): Promise<TwitchChannelWithLatestInfo | null> {
    return await this.db.twitchChannel.findUnique({
      where: { twitchId: twitchChannelId },
      include: channelQuery_includeLatestChannelInfo
    })
  }

  /** `previousOrExistingImageId` must be the id of the `image` attached to the previous global channel info if `onGetImageInfo` is null, and the id of the existing `image` object associated with the new imageUrl otherwise. If `onGetImageInfo` is null, no new image will be created and thus no update will be made to the `imageId`. */
  public async updateYoutubeChannel_Global (
    externalId: string,
    channelInfo: SafeOmit<CreateOrUpdateGlobalYoutubeChannelArgs, 'imageId'>,
    previousOrExistingImageId: number,
    onGetImageInfo: ((channelId: number, channelGlobalInfoId: number) => Promise<ImageInfo>) | null
  ): Promise<YoutubeChannelWithLatestInfo> {
    const channel = await this.db.youtubeChannel.update({
      where: { youtubeId: externalId },
      data: { globalInfoHistory: { create: { time: channelInfo.time, name: channelInfo.name, imageUrl: channelInfo.imageUrl, isVerified: channelInfo.isVerified, imageId: previousOrExistingImageId } } },
      include: channelQuery_includeLatestChannelInfo
    })

    // check if we need to update the image and, if so, update the record we just created
    const globalInfo = channel.globalInfoHistory[0]
    let imageId = globalInfo.imageId
    if (onGetImageInfo != null) {
      const imageInfo = await onGetImageInfo(channel.id, globalInfo.id)
      const newImage = await this.db.image.create({
        data: {
          fingerprint: getYoutubeChannelImageFingerprint(globalInfo.imageUrl),
          url: imageInfo.relativeImageUrl,
          originalUrl: globalInfo.imageUrl,
          width: imageInfo.imageWidth,
          height: imageInfo.imageHeight
        }
      })
      imageId = newImage.id
      await this.db.youtubeChannelGlobalInfo.update({
        where: { id: globalInfo.id },
        data: { imageId: imageId }
      })
    }

    // mutate the full result to reflect the correct image id
    return {
      ...channel,
      globalInfoHistory: [{
        ...globalInfo,
        imageId: imageId
      }]
    }
  }

  public async updateYoutubeChannel_Streamer (externalId: string, channelInfo: CreateOrUpdateStreamerYoutubeChannelArgs): Promise<void> {
    await this.db.youtubeChannel.update({
      where: { youtubeId: externalId },
      data: { streamerInfoHistory: { create: { streamerId: channelInfo.streamerId, time: channelInfo.time, isOwner: channelInfo.isOwner, isModerator: channelInfo.isModerator } } }
    })
  }

  public async updateTwitchChannel_Global (externalId: string, channelInfo: CreateOrUpdateGlobalTwitchChannelArgs): Promise<TwitchChannelWithLatestInfo> {
    return await this.db.twitchChannel.update({
      where: { twitchId: externalId },
      data: { globalInfoHistory: { create: { time: channelInfo.time, userName: channelInfo.userName, displayName: channelInfo.displayName, userType: channelInfo.userType, colour: channelInfo.colour } } },
      include: channelQuery_includeLatestChannelInfo
    })
  }

  public async updateTwitchChannel_Streamer (externalId: string, channelInfo: CreateOrUpdateStreamerTwitchChannelArgs): Promise<void> {
    await this.db.twitchChannel.update({
      where: { twitchId: externalId },
      data: { streamerInfoHistory: { create: { streamerId: channelInfo.streamerId, time: channelInfo.time, isBroadcaster: channelInfo.isBroadcaster, isMod: channelInfo.isMod, isSubscriber: channelInfo.isSubscriber, isVip: channelInfo.isVip } } }
    })
  }
}

export const channelQuery_includeLatestChannelInfo = Prisma.validator<Prisma.YoutubeChannelInclude>()({
  globalInfoHistory: {
    orderBy: { time: Prisma.SortOrder.desc },
    take: 1
  },
  user: true
})

export function getYoutubeChannelImageFingerprint (url: string) {
  return `channel/youtube/${url}`
}
