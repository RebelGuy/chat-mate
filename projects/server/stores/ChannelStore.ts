import { YoutubeChannelInfo, Prisma, TwitchChannelInfo } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { ChatPlatform } from '@rebel/server/models/chat'
import { New, Entity } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { ObjectComparator } from '@rebel/server/types'
import { subGroupedSingle, zipOn } from '@rebel/server/util/arrays'
import { assertUnreachable, compare } from '@rebel/server/util/typescript'

export type CreateOrUpdateYoutubeChannelArgs = Omit<New<YoutubeChannelInfo>, 'channelId'>
export type CreateOrUpdateTwitchChannelArgs = Omit<New<TwitchChannelInfo>, 'channelId'>

export type YoutubeChannelWithLatestInfo = Omit<Entity.YoutubeChannel, 'chatMessages' | 'user'>
export type TwitchChannelWithLatestInfo = Omit<Entity.TwitchChannel, 'chatMessages' | 'user'>

/** Contains the most recent name of each channel that the user owns. */
export type UserNames = { userId: number, youtubeNames: string[], twitchNames: string[] }

/** Contains all channels on all platforms owned by the user. */
export type UserOwnedChannels = {
  userId: number,
  youtubeChannels: number[],
  twitchChannels: number[]
}

export type UserChannel = {
  userId: number
  platformInfo: {
    platform: Extract<ChatPlatform, 'youtube'>
    channel: YoutubeChannelWithLatestInfo
  } | {
    platform: Extract<ChatPlatform, 'twitch'>
    channel: TwitchChannelWithLatestInfo
  }
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

  /** Returns all effective chat user ids. */
  public async getCurrentUserIds (): Promise<number[]> {
    const users = await this.db.chatUser.findMany({
      where: { aggregateChatUserId: null }
    })
    return users.map(user => user.id)
  }

  /** Returns the most current names of all channels of a user (unordered). */
  public async getCurrentUserNames (): Promise<UserNames[]> {
    const currentChannelInfos = await this.db.youtubeChannelInfo.findMany({
      distinct: ['channelId'],
      orderBy: { time: 'desc' },
      select: {
        name: true,
        channel: { select: { id: true, userId: true }},
        time: true
      }
    })
    const latestYoutubeNames = subGroupedSingle(currentChannelInfos, info => info.channel.userId, info => info.channel.id)
      .map(info => ({ userId: info.group, youtubeNames: info.subgrouped.map(sg => sg.name) }))

    const currentTwitchChannelInfos = await this.db.twitchChannelInfo.findMany({
      distinct: ['channelId'],
      orderBy: { time: 'desc' },
      select: {
        displayName: true,
        channel: { select: { id: true, userId: true }},
        time: true
      }
    })
    const latestTwitchNames = subGroupedSingle(currentTwitchChannelInfos, info => info.channel.userId, info => info.channel.id)
      .map(info => ({ userId: info.group, twitchNames: info.subgrouped.map(sg => sg.displayName) }))

    const names = zipOn(latestYoutubeNames, latestTwitchNames, 'userId')

    return names.map(name => ({
      userId: name.userId,
      youtubeNames: name.youtubeNames ?? [],
      twitchNames: name.twitchNames ?? []
    }))
  }

  /** Gets the user's name, e.g. rebel_guymc. */
  public async getTwitchUserNameFromChannelId (twitchChannelId: number): Promise<string> {
    const channel = await this.db.twitchChannel.findUnique({
      where: { id: twitchChannelId },
      rejectOnNotFound: true,
      include: channelQuery_includeLatestChannelInfo
    })
    return channel.infoHistory[0].userName
  }

  public async getYoutubeChannelNameFromChannelId (youtubeChannelId: number): Promise<string> {
    const channel = await this.db.youtubeChannel.findUnique({
      where: { id: youtubeChannelId },
      rejectOnNotFound: true,
      include: channelQuery_includeLatestChannelInfo
    })
    return channel.infoHistory[0].name
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

  /** Returns the channels associated with the chat user. The chat user can either be a default user, or aggregate user, but all channels connected directly or indirectly to the user will be returned.
   * Throws if the user does not exist. */
  public async getUserOwnedChannels (userId: number): Promise<UserOwnedChannels> {
    const registeredUser = await this.db.registeredUser.findFirst({ where: { aggregateChatUserId: userId }})
    const isAggregateUser = registeredUser != null

    if (isAggregateUser) {
      // get all default users attached to this aggregate user
      return await this.getAggregateUserOwnedChannels(userId)
    } else {
      const defaultUser = await this.db.chatUser.findUnique({
        where: { id: userId },
        rejectOnNotFound: true,
        include: {
          youtubeChannels: { select: { id: true }},
          twitchChannels: { select: { id: true }}
        },
      })

      if (defaultUser.aggregateChatUserId == null) {
        // this is a standalone default user
        return {
          userId: defaultUser.id,
          youtubeChannels: defaultUser.youtubeChannels.map(c => c.id),
          twitchChannels: defaultUser.twitchChannels.map(c => c.id)
        }
      } else {
        // this default user is connected to an aggregate user
        return await this.getAggregateUserOwnedChannels(defaultUser.aggregateChatUserId)
      }
    }
  }

  /** Like `getUserOwnedChannels`, but returns only the channels for the default user, ignoring any connected users. */
  public async getDefaultUserOwnedChannels (defaultUserId: number): Promise<UserOwnedChannels> {
    const result = await this.db.chatUser.findUnique({
      where: { id: defaultUserId },
      rejectOnNotFound: true,
      include: {
        youtubeChannels: { select: { id: true }},
        twitchChannels: { select: { id: true }}
      },
    })

    return {
      userId: result.id,
      youtubeChannels: result.youtubeChannels.map(c => c.id),
      twitchChannels: result.twitchChannels.map(c => c.id)
    }
  }

  /** Returns all user channels connected to this aggregate user. */
  private async getAggregateUserOwnedChannels (aggregateChatUserId: number): Promise<UserOwnedChannels> {
    const defaultUsers = await this.db.chatUser.findMany({
      where: { aggregateChatUserId: aggregateChatUserId },
      include: {
        youtubeChannels: { select: { id: true }},
        twitchChannels: { select: { id: true }}
      },
    })

    return {
      userId: aggregateChatUserId,
      youtubeChannels: defaultUsers.flatMap(u => u.youtubeChannels.map(c => c.id)),
      twitchChannels: defaultUsers.flatMap(u => u.twitchChannels.map(c => c.id))
    }
  }

  /** Returns the same userId if the chat user is a default user, otherwise returns the id of the attached aggregate user. */
  private async getPrimaryUserIdForUser (userId: number) {
    const chatUser = await this.db.chatUser.findFirst({
      where: { id: userId },
      include: { registeredUser: true, aggregateChatUser: true }
    })

    if (chatUser!.registeredUser != null) {
      // is an aggregate user
      return userId
    } else if (chatUser!.aggregateChatUserId != null) {
      // is linked to an aggreate user
      return chatUser!.aggregateChatUserId
    } else {
      // is a default user
      return userId
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

const channelQuery_includeLatestChannelInfo = Prisma.validator<Prisma.YoutubeChannelInclude>()({
  infoHistory: {
    orderBy: { time: 'desc' },
    take: 1
  }
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
