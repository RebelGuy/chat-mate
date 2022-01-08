import { ChatMessage, ExperienceDataChatMessage, ExperienceSnapshot, ExperienceTransaction } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { Entity } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { NoNulls } from '@rebel/server/types'

export type ChatExperience =
  NoNulls<Pick<Entity.ExperienceTransaction, 'time' | 'delta' | 'channel' | 'experienceDataChatMessage' | 'livestream'>>
  & { experienceDataChatMessage: { chatMessage: ChatMessage} }

export type ChatExperienceData = Pick<Entity.ExperienceDataChatMessage,
  'baseExperience' | 'viewershipStreakMultiplier' | 'participationStreakMultiplier' | 'spamMultiplier' | 'messageQualityMultiplier'>
  & { chatMessageYtId: string }

type Deps = Dependencies<{
  dbProvider: DbProvider
  livestreamStore: LivestreamStore
}>

export default class ExperienceStore {
  private readonly db: Db
  private readonly livestreamStore: LivestreamStore

  // key is channelId
  // value is null if we know there is no data for a particular channel
  private readonly chatExperienceMap: Map<string, ChatExperience | null>

  constructor (deps: Deps) {
    this.db = deps.resolve('dbProvider').get()
    this.livestreamStore = deps.resolve('livestreamStore')
    this.chatExperienceMap = new Map()
  }

  // returns the previous chat experience, may not be for the current livestream
  public async getPreviousChatExperience (channelId: string): Promise<ChatExperience | null> {
    if (this.chatExperienceMap.has(channelId)) {
      return this.chatExperienceMap.get(channelId)!
    }

    const experienceTransaction = await this.db.experienceTransaction.findFirst({
      where: { channel: { youtubeId: channelId }, experienceDataChatMessage: { isNot: null }},
      orderBy: { time: 'desc' },
      include: { livestream: true, experienceDataChatMessage: { include: { chatMessage: true }}, channel: true }
    })

    return this.cacheChatExperience(channelId, experienceTransaction)
  }

  public async addChatExperience (channelId: string, timestamp: number, xp: number, data: ChatExperienceData) {
    // don't allow backfilling or duplicates
    const prev = await this.getPreviousChatExperience(channelId)
    if (prev && (prev.time.getTime() > timestamp || prev.experienceDataChatMessage.chatMessage.youtubeId === data.chatMessageYtId)) {
      return
    }

    await this.initialiseSnapshotIfRequired(channelId, timestamp)
    const experienceTransaction = await this.db.experienceTransaction.create({
      data: {
        time: new Date(timestamp),
        channel: { connect: { youtubeId: channelId }},
        livestream: { connect: { id: this.livestreamStore.currentLivestream.id }},
        delta: xp,
        experienceDataChatMessage: { create: {
          baseExperience: data.baseExperience,
          viewershipStreakMultiplier: data.viewershipStreakMultiplier,
          participationStreakMultiplier: data.participationStreakMultiplier,
          spamMultiplier: data.spamMultiplier,
          messageQualityMultiplier: data.messageQualityMultiplier,
          chatMessage: { connect: { youtubeId: data.chatMessageYtId }}
        }}
      },
      include: { livestream: true, experienceDataChatMessage: { include: { chatMessage: true }}, channel: true }
    })

    this.cacheChatExperience(channelId, experienceTransaction)
  }

  public async getLatestSnapshot (channelId: string): Promise<ExperienceSnapshot | null> {
    return this.db.experienceSnapshot.findFirst({
      where: { channel: { youtubeId: channelId }},
      orderBy: { time: 'desc' }
    })
  }

  // in ascending order
  public async getTransactionsStartingAt (channelId: string, timestamp: number): Promise<ExperienceTransaction[]> {
    return this.db.experienceTransaction.findMany({
      where: {
        channel: { youtubeId: channelId },
        time: { gte: new Date(timestamp) }
      },
      orderBy: { time: 'asc' }
    })
  }

  private cacheChatExperience (channelId: string, experienceTransaction: (Omit<ChatExperience, 'experienceDataChatMessage'> & { experienceDataChatMessage: (ExperienceDataChatMessage & { chatMessage: ChatMessage }) | null }) | null)
    : ChatExperience | null {
    let result: ChatExperience | null
    if (experienceTransaction) {
      result = {
        ...experienceTransaction,
        // no way to narrow this down using type guards... thanks typescript!
        experienceDataChatMessage: experienceTransaction.experienceDataChatMessage!
      }
    } else {
      result = null
    }

    this.chatExperienceMap.set(channelId, result)
    return result
  }

  private async initialiseSnapshotIfRequired (channelId: string, timestamp: number) {
    // the existence of a previous experience entry implies that a snapshot already exists
    if (this.chatExperienceMap.get(channelId)) {
      return
    }

    const existing = await this.getLatestSnapshot(channelId)
    if (existing) {
      return
    }

    await this.db.experienceSnapshot.create({ data: {
      time: new Date(timestamp),
      experience: 0,
      channel: { connect: { youtubeId: channelId }}
    }})
  }
}
