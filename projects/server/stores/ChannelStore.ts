import { Channel, ChannelInfo, Prisma } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { New, Entity } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { ObjectComparator } from '@rebel/server/types'
import { compare } from '@rebel/server/util/typescript'

export type CreateOrUpdateChannelArgs = Omit<New<ChannelInfo>, 'channelId'>

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class ChannelStore {
  private readonly db: Db

  constructor (deps: Deps) {
    this.db = deps.resolve('dbProvider').get()
  }

  public async exists (channelId: string): Promise<boolean> {
    return (await this.db.channel.findUnique({ where: { youtubeId: channelId }})) != null
  }

  public async getCurrent (channelId: string): Promise<Omit<Entity.Channel, 'chatMessages'> | null> {
    return this.tryGetChannelWithLatestInfo(channelId)
  }

  // from newest to oldest
  public async getHistory (channelId: string): Promise<Entity.ChannelInfo[] | null> {
    const channel = await this.db.channel.findUnique({
      where: { youtubeId: channelId },
      include: {
        infoHistory: {
          orderBy: { time: 'desc' },
          include: { channel: true }
        }
      },
    })

    return channel?.infoHistory ?? null
  }

  public async createOrUpdate (channelId: string, channelInfo: CreateOrUpdateChannelArgs): Promise<Omit<Entity.Channel, 'chatMessages'>> {
    const currentChannel = await this.tryGetChannelWithLatestInfo(channelId)
    const storedInfo = currentChannel?.infoHistory[0]

    let channel: Omit<Entity.Channel, 'chatMessages'>
    if (currentChannel != null) {
      // if anything has changed, create a new ChannelInfo object and link it to the channel
      if (storedInfo!.time < channelInfo.time && !compare(storedInfo!, channelInfo, channelInfoComparator)) {
        channel = await this.db.channel.update({
          where: { youtubeId: channelId },
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
          youtubeId: channelId,
          infoHistory: { create: channelInfo }
        },
        include: channelQuery_includeLatestChannelInfo
      })
    }

    return channel
  }

  private async tryGetChannelWithLatestInfo (channelId: string) {
    return await this.db.channel.findUnique({
      where: { youtubeId: channelId },
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