import { ChannelInfo, Prisma, TwitchChannelInfo } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { ChatPlatform } from '@rebel/server/models/chat'
import { New, Entity } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { ObjectComparator } from '@rebel/server/types'
import { subGroupedSingle, zipOn } from '@rebel/server/util/arrays'
import { assertUnreachable, compare } from '@rebel/server/util/typescript'

export const ADMIN_YOUTUBE_ID = 'UCBDVDOdE6HOvWdVHsEOeQRA'

export type CreateOrUpdateChannelArgs = Omit<New<ChannelInfo>, 'channelId'>
export type CreateOrUpdateTwitchChannelArgs = Omit<New<TwitchChannelInfo>, 'channelId'>

export type ChannelWithLatestInfo = Omit<Entity.Channel, 'chatMessages' | 'user'>
export type TwitchChannelWithLatestInfo = Omit<Entity.TwitchChannel, 'chatMessages' | 'user'>

/** Contains the most recent name of each channel that the user owns. */
export type UserNames = { userId: number, youtubeNames: string[], twitchNames: string[] }

export type UserChannel = {
  platform: Extract<ChatPlatform, 'youtube'>
  channel: ChannelWithLatestInfo
} | {
  platform: Extract<ChatPlatform, 'twitch'>
  channel: TwitchChannelWithLatestInfo
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

  public async createOrUpdate (platform: Extract<ChatPlatform, 'youtube'>, externalId: string, channelInfo: CreateOrUpdateChannelArgs): Promise<ChannelWithLatestInfo>
  public async createOrUpdate (platform: Extract<ChatPlatform, 'twitch'>, externalId: string, channelInfo: CreateOrUpdateTwitchChannelArgs): Promise<TwitchChannelWithLatestInfo>
  public async createOrUpdate (platform: ChatPlatform, externalId: string, channelInfo: CreateOrUpdateChannelArgs | CreateOrUpdateTwitchChannelArgs): Promise<ChannelWithLatestInfo | TwitchChannelWithLatestInfo> {
    // the reason we don't have separate createOrUpdate methods for each platform is that there is some shared logic that we don't want to replicate.
    // I toyed with adding an adapter, and making the method generic, but setting up the prisma validators was a pain so I opted for this.
  
    let currentChannel: ChannelWithLatestInfo | TwitchChannelWithLatestInfo | null
    if (platform === 'youtube') {
      currentChannel = await this.tryGetChannelWithLatestInfo(externalId)
    } else if (platform === 'twitch') {
      currentChannel = await this.tryGetTwitchChannelWithLatestInfo(externalId)
    } else {
      assertUnreachable(platform)
    }
    const storedInfo = currentChannel?.infoHistory[0] ?? null

    let channel: ChannelWithLatestInfo | TwitchChannelWithLatestInfo
    if (currentChannel != null) {
      // check if anything has changed - if so, update info
      if (channelInfoHasChanged(platform, storedInfo!, channelInfo)) {
        if (platform === 'youtube') {
          channel = await this.db.channel.update({
            where: { youtubeId: externalId },
            data: { infoHistory: { create: channelInfo as CreateOrUpdateChannelArgs } },
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
        channel = await this.db.channel.create({
          data: {
            youtubeId: externalId,
            user: { create: {}},
            infoHistory: { create: channelInfo as CreateOrUpdateChannelArgs }
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

  /** Returns the most current names of all channels of a user. */
  public async getCurrentUserNames (): Promise<UserNames[]> {
    const currentChannelInfos = await this.db.channelInfo.findMany({
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

  /** Gets the userId that is associated with the channel that has the given external id. Throws if none is found. */
  public async getUserId (externalId: string): Promise<number> {
    const channel = await this.db.channel.findUnique({ where: { youtubeId: externalId } })
    if (channel != null) {
      return channel.userId
    }

    const twitchChannel = await this.db.twitchChannel.findUnique({ where: { twitchId: externalId } })
    if (twitchChannel != null) {
      return twitchChannel.userId
    }
    
    throw new Error('Cannot find user with external id ' + externalId)
  }

  private async tryGetChannelWithLatestInfo (youtubeChannelId: string) {
    return await this.db.channel.findUnique({
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

const channelQuery_includeLatestChannelInfo = Prisma.validator<Prisma.ChannelInclude>()({
  infoHistory: {
    orderBy: { time: 'desc' },
    take: 1
  }
})

const youtubeChannelInfoComparator: ObjectComparator<CreateOrUpdateChannelArgs> = {
  imageUrl: 'default',
  name: 'default',
  time: null,
  isOwner: 'default',
  isModerator: 'default',
  IsVerified: 'default'
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

function channelInfoHasChanged (platform: ChatPlatform, storedInfo: ChannelInfo | TwitchChannelInfo, newInfo: CreateOrUpdateChannelArgs | CreateOrUpdateTwitchChannelArgs): boolean {
  let comparator: ObjectComparator<CreateOrUpdateChannelArgs> | ObjectComparator<CreateOrUpdateTwitchChannelArgs>
  if (platform === 'youtube') {
    comparator = youtubeChannelInfoComparator
  } else if (platform === 'twitch') {
    comparator = twitchChannelInfoComparator
  } else {
    assertUnreachable(platform)
  }

  return storedInfo!.time < newInfo.time && !compare(storedInfo, newInfo, comparator)
}
