import { YoutubeChannelInfo, Prisma, TwitchChannelInfo, TwitchChannel, YoutubeChannel } from '@prisma/client'
import { nonNull } from '@rebel/server/util/arrays'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { ChatPlatform } from '@rebel/server/models/chat'
import { New, Entity } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { ObjectComparator } from '@rebel/server/types'
import { assertUnreachable, compare } from '@rebel/server/util/typescript'

export type CreateOrUpdateYoutubeChannelArgs = Omit<New<YoutubeChannelInfo>, 'channelId'>
export type CreateOrUpdateTwitchChannelArgs = Omit<New<TwitchChannelInfo>, 'channelId'>

export type YoutubeChannelWithLatestInfo = Omit<Entity.YoutubeChannel, 'chatMessages' | 'user' | 'streamerYoutubeChannelLink'>
export type TwitchChannelWithLatestInfo = Omit<Entity.TwitchChannel, 'chatMessages' | 'user' | 'streamerTwitchChannelLink'>

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
    platform: Extract<ChatPlatform, 'youtube'>
    channel: YoutubeChannelWithLatestInfo
  } : never) | (TPlatform extends 'twitch' ? {
    platform: Extract<ChatPlatform, 'twitch'>
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

  public async createOrUpdate (platform: Extract<ChatPlatform, 'youtube'>, externalId: string, channelInfo: CreateOrUpdateYoutubeChannelArgs): Promise<YoutubeChannelWithLatestInfo>
  public async createOrUpdate (platform: Extract<ChatPlatform, 'twitch'>, externalId: string, channelInfo: CreateOrUpdateTwitchChannelArgs): Promise<TwitchChannelWithLatestInfo>
  public async createOrUpdate (platform: ChatPlatform, externalId: string, channelInfo: CreateOrUpdateYoutubeChannelArgs | CreateOrUpdateTwitchChannelArgs): Promise<YoutubeChannelWithLatestInfo | TwitchChannelWithLatestInfo> {
    // the reason we don't have separate createOrUpdate methods for each platform is that there is some shared logic that we don't want to replicate.
    // I toyed with adding an adapter, and making the method generic, but setting up the prisma validators was a pain so I opted for this.

    let currentChannel: YoutubeChannelWithLatestInfo | TwitchChannelWithLatestInfo | null
    if (platform === 'youtube') {
      currentChannel = await this.tryGetChannelWithLatestInfo(externalId)
    } else if (platform === 'twitch') {
      currentChannel = await this.tryGetTwitchChannelWithLatestInfo(externalId)
    } else {
      assertUnreachable(platform)
    }
    const storedInfo = currentChannel?.infoHistory[0] ?? null

    let channel: YoutubeChannelWithLatestInfo | TwitchChannelWithLatestInfo
    if (currentChannel != null) {
      // check if anything has changed - if so, update info
      if (channelInfoHasChanged(platform, storedInfo!, channelInfo)) {
        if (platform === 'youtube') {
          channel = await this.db.youtubeChannel.update({
            where: { youtubeId: externalId },
            data: { infoHistory: { create: channelInfo as CreateOrUpdateYoutubeChannelArgs } },
            include: channelQuery_includeLatestChannelInfo
          })
        } else if (platform === 'twitch') {
          channel = await this.db.twitchChannel.update({
            where: { twitchId: externalId },
            data: { infoHistory: { create: channelInfo as CreateOrUpdateTwitchChannelArgs } },
            include: channelQuery_includeLatestChannelInfo
          })
        }

      } else {
        // nothing has changed: keep using the stored info
        channel = currentChannel
      }

    } else {
      // create new channel
      if (platform === 'youtube') {
        channel = await this.db.youtubeChannel.create({
          data: {
            youtubeId: externalId,
            user: { create: {}},
            infoHistory: { create: channelInfo as CreateOrUpdateYoutubeChannelArgs }
          },
          include: channelQuery_includeLatestChannelInfo
        })
      } else if (platform === 'twitch') {
        channel = await this.db.twitchChannel.create({
          data: {
            twitchId: externalId,
            user: { create: {}},
            infoHistory: { create: channelInfo as CreateOrUpdateTwitchChannelArgs }
          },
          include: channelQuery_includeLatestChannelInfo
        })
      }
    }

    return channel!
  }

  /** Returns channels that have authored chat messages for the given streamer. */
  public async getAllChannels (streamerId: number): Promise<UserChannel[]> {
    const currentYoutubeChannelInfos = await this.db.youtubeChannelInfo.findMany({
      distinct: ['channelId'],
      orderBy: { time: 'desc' },
      include: { channel: { include: { user: true }}},
      where: { channel: { chatMessages: { some: { streamerId }}}} // omfg that works?!
    })
    const youtubeChannels = currentYoutubeChannelInfos.map<UserChannel>(info => ({
      defaultUserId: info.channel.userId,
      aggregateUserId: info.channel.user.aggregateChatUserId,
      platformInfo: {
        platform: 'youtube',
        channel: { id: info.channel.id, youtubeId: info.channel.youtubeId, userId: info.channel.userId, infoHistory: [info] }
      }
    }))

    const currentTwitchChannelInfos = await this.db.twitchChannelInfo.findMany({
      distinct: ['channelId'],
      orderBy: { time: 'desc' },
      include: { channel: { include: { user: true }}},
      where: { channel: { chatMessages: { some: { streamerId }}}}
    })
    const twitchChannels = currentTwitchChannelInfos.map<UserChannel>(info => ({
      defaultUserId: info.channel.userId,
      aggregateUserId: info.channel.user.aggregateChatUserId,
      platformInfo: {
        platform: 'twitch',
        channel: { id: info.channel.id, twitchId: info.channel.twitchId, userId: info.channel.userId, infoHistory: [info] }
      }
    }))

    return [...youtubeChannels, ...twitchChannels]
  }

  /** For each of the given internal twitch ids, returns the latest channel info. Throws if any channels could not be found. */
  public async getTwitchChannelFromChannelId (twitchChannelIds: number[]): Promise<UserChannel<'twitch'>[]> {
    const channels = await this.db.twitchChannel.findMany({
      where: { id: { in: twitchChannelIds } },
      include: channelQuery_includeLatestChannelInfo
    })

    return twitchChannelIds.map<UserChannel>(channelId => {
      const channel = channels.find(c => c.id === channelId)
      if (channel == null) {
        throw new Error(`Unable to find TwitchChannel with id ${channelId}`)
      }

      return {
        defaultUserId: channel.userId,
        aggregateUserId: channel.user.aggregateChatUserId,
        platformInfo: { platform: 'twitch', channel: channel }
      }
    })
  }

  /** For each of the given internal youtube ids, returns the latest channel info. Throws if any channels could not be found. */
  public async getYoutubeChannelFromChannelId (youtubeChannelIds: number[]): Promise<UserChannel<'youtube'>[]> {
    const channels = await this.db.youtubeChannel.findMany({
      where: { id: { in: youtubeChannelIds } },
      include: channelQuery_includeLatestChannelInfo
    })

    return youtubeChannelIds.map<UserChannel>(channelId => {
      const channel = channels.find(c => c.id === channelId)
      if (channel == null) {
        throw new Error(`Unable to find YoutubeChannel with id ${channelId}`)
      }

      return {
        defaultUserId: channel.userId,
        aggregateUserId: channel.user.aggregateChatUserId,
        platformInfo: { platform: 'youtube', channel: channel }
      }
    })
  }

  /** Returns null if the channel was not found. Not case sensitive. Do NOT provide the twitch external id - provide the twitch username instead. */
  public async getChannelFromUserNameOrExternalId (externalIdOrUserName: string): Promise<YoutubeChannel | TwitchChannel | null> {
    const youtubeChannel = await this.db.youtubeChannel.findUnique({ where: { youtubeId: externalIdOrUserName } })
    if (youtubeChannel != null) {
      return youtubeChannel
    }

    const twitchChannel = await this.db.twitchChannelInfo.findFirst({
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

    throw new Error('Cannot find user with external id ' + externalId)
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
        throw new Error(`Could not find connected channels for user ${id}`)
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
        throw new Error(`Could not find default user ${id}`)
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

  private async tryGetChannelWithLatestInfo (youtubeChannelId: string) {
    return await this.db.youtubeChannel.findUnique({
      where: { youtubeId: youtubeChannelId },
      include: channelQuery_includeLatestChannelInfo
    })
  }

  private async tryGetTwitchChannelWithLatestInfo (twitchChannelId: string) {
    return await this.db.twitchChannel.findUnique({
      where: { twitchId: twitchChannelId },
      include: channelQuery_includeLatestChannelInfo
    })
  }
}

export const channelQuery_includeLatestChannelInfo = Prisma.validator<Prisma.YoutubeChannelInclude>()({
  infoHistory: {
    orderBy: { time: 'desc' },
    take: 1
  },
  user: true
})

const youtubeChannelInfoComparator: ObjectComparator<CreateOrUpdateYoutubeChannelArgs> = {
  imageUrl: 'default',
  name: 'default',
  time: null,
  isOwner: 'default',
  isModerator: 'default',
  isVerified: 'default'
}

const twitchChannelInfoComparator: ObjectComparator<CreateOrUpdateTwitchChannelArgs> = {
  time: null,
  userName: 'default',
  displayName: 'default',
  userType: 'default',
  isBroadcaster: 'default',
  isSubscriber: 'default',
  isMod: 'default',
  isVip: 'default',
  colour: 'default'
}

function channelInfoHasChanged (platform: ChatPlatform, storedInfo: YoutubeChannelInfo | TwitchChannelInfo, newInfo: CreateOrUpdateYoutubeChannelArgs | CreateOrUpdateTwitchChannelArgs): boolean {
  let comparator: ObjectComparator<CreateOrUpdateYoutubeChannelArgs> | ObjectComparator<CreateOrUpdateTwitchChannelArgs>
  if (platform === 'youtube') {
    comparator = youtubeChannelInfoComparator
  } else if (platform === 'twitch') {
    comparator = twitchChannelInfoComparator
  } else {
    assertUnreachable(platform)
  }

  return storedInfo!.time < newInfo.time && !compare(storedInfo, newInfo, comparator)
}
