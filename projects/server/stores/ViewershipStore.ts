import { Livestream } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { Entity } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { NoNulls } from '@rebel/server/types'

export type ChatExperience = NoNulls<Pick<Entity.ExperienceTransaction, 'time' | 'delta' | 'channel' | 'experienceDataChatMessage'>>

export type LivestreamParticipation = Livestream & { channelId: string, participated: boolean }

export type LivestreamViewership = Livestream & { channelId: string, viewed: boolean }

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class ExperienceStore {
  private readonly db: Db

  constructor (deps: Deps) {
    this.db = deps.resolve('dbProvider').get()
  }

  // returns the time of the previous viewing block
  public async getLastSeen (channelId: string, ignoreCurrentBlock: boolean): Promise<{ livestream: Livestream, time: Date } | null> {
    const block = await this.db.viewingBlock.findFirst({
      where: { channel: { youtubeId: channelId }, isComplete: ignoreCurrentBlock ? true : undefined },
      orderBy: { lastUpdate: 'desc'},
      include: { livestream: true }
    })

    if (block) {
      return {
        livestream: block.livestream,
        time: block.lastUpdate
      }
    } else {
      return null
    }
  }

  // returns streams in ascending order.
  // the following actions are considered participation:
  // - sending a message in chat
  public async getLivestreamParticipation (channelId: string): Promise<LivestreamParticipation[]> {
    const livestreams = await this.db.livestream.findMany({
      include: {
        chatMessages: {
          where: { channel: { youtubeId: channelId }},
          take: 1
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return livestreams.map(l => ({
      ...l,
      channelId,
      participated: l.chatMessages.length > 0
    }))
  }

  // returns streams in ascending order
  public async getLivestreamViewership (channelId: string): Promise<LivestreamViewership[]> {
    const livestreams = await this.db.livestream.findMany({
      include: {
        viewingBlocks: {
          where: { channel: { youtubeId: channelId }},
          take: 1
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return livestreams.map(l => ({
      ...l,
      channelId,
      viewed: l.viewingBlocks.length > 0
    }))
  }
}
