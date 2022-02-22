import { Channel, ChannelInfo, Prisma } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { New, Entity } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { ObjectComparator } from '@rebel/server/types'
import { compare } from '@rebel/server/util/typescript'

export const ADMIN_YOUTUBE_ID = 'UCBDVDOdE6HOvWdVHsEOeQRA'

export type CreateOrUpdateChannelArgs = Omit<New<ChannelInfo>, 'channelId'>

export type ChannelWithLatestInfo = Omit<Entity.Channel, 'chatMessages' | 'experienceTransactions' | 'experienceSnapshots' | 'viewingBlocks' | 'experienceDataAdministered'>

export type ChannelName = { id: number, name: string }

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class ChannelStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
  }

  public async getCurrent (channelId: number): Promise<ChannelWithLatestInfo | null> {
    return this.tryGetChannelWithLatestInfo(channelId)
  }

  // from newest to oldest
  public async getHistory (channelId: number): Promise<Entity.ChannelInfo[] | null> {
    const channel = await this.db.channel.findUnique({
      where: { id: channelId },
      include: {
        infoHistory: {
          orderBy: { time: 'desc' },
          include: { channel: true }
        }
      },
    })

    return channel?.infoHistory ?? null
  }

  public async createOrUpdate (youtubeChannelId: string, channelInfo: CreateOrUpdateChannelArgs): Promise<ChannelWithLatestInfo> {
    const currentChannel = await this.tryGetChannelWithLatestInfo(youtubeChannelId)
    const storedInfo = currentChannel?.infoHistory[0]

    let channel: ChannelWithLatestInfo
    if (currentChannel != null) {
      // if anything has changed, create a new ChannelInfo object and link it to the channel
      if (storedInfo!.time < channelInfo.time && !compare(storedInfo!, channelInfo, channelInfoComparator)) {
        channel = await this.db.channel.update({
          where: { youtubeId: youtubeChannelId },
          data: {
            infoHistory: { create: channelInfo }
          },
          include: channelQuery_includeLatestChannelInfo
        })
      } else {
        // nothing has changed: keep using the stored info
        channel = currentChannel
      }

    } else {
      channel = await this.db.channel.create({
        data: {
          youtubeId: youtubeChannelId,
          infoHistory: { create: channelInfo }
        },
        include: channelQuery_includeLatestChannelInfo
      })
    }

    return channel
  }

  /** Returns all channels with their current names. */
  public async getCurrentChannelNames (): Promise<ChannelName[]> {
    const currentChannelInfos = await this.db.channelInfo.findMany({
      distinct: ['channelId'],
      orderBy: { time: 'desc' },
      select: { name: true, channel: { select: { id: true, youtubeId: true }} }
    })

    return currentChannelInfos.map(info => ({
      id: info.channel.id,
      name: info.name
    }))
  }

  /** Throws if id is not found. */
  public async getId (youtubeId: string): Promise<number> {
    const channel = await this.db.channel.findUnique({ where: { youtubeId }, rejectOnNotFound: true })
    return channel.id
  }

  private async tryGetChannelWithLatestInfo (channelId: string | number) {
    const youtubeId: string | undefined = typeof channelId === 'string' ? channelId : undefined
    const id: number | undefined = typeof channelId === 'number' ? channelId : undefined

    return await this.db.channel.findUnique({
      where: { youtubeId, id },
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

const channelInfoComparator: ObjectComparator<CreateOrUpdateChannelArgs> = {
  imageUrl: 'default',
  name: 'default',
  time: null,
  isOwner: 'default',
  isModerator: 'default',
  IsVerified: 'default'
}
