import { ChatMessage, ExperienceDataChatMessage, ExperienceSnapshot, ExperienceTransaction } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { Entity } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { ADMIN_YOUTUBE_ID } from '@rebel/server/stores/ChannelStore'
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

export default class ExperienceStore extends ContextClass {
  private readonly db: Db
  private readonly livestreamStore: LivestreamStore

  // key is channelId
  // value is null if we know there is no data for a particular channel
  private readonly previousChatExperienceMap: Map<number, ChatExperience | null>

  // the timestamp cache of the last experience transaction, if known
  private lastTransactionTime: number | null

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
    this.livestreamStore = deps.resolve('livestreamStore')
    this.previousChatExperienceMap = new Map()
    this.lastTransactionTime = null
  }

  // returns the previous chat experience, may not be for the current livestream
  public async getPreviousChatExperience (channelId: number): Promise<ChatExperience | null> {
    if (this.previousChatExperienceMap.has(channelId)) {
      return this.previousChatExperienceMap.get(channelId)!
    }

    const experienceTransaction = await this.db.experienceTransaction.findFirst({
      where: { channel: { id: channelId }, experienceDataChatMessage: { isNot: null }},
      orderBy: { time: 'desc' },
      include: { livestream: true, experienceDataChatMessage: { include: { chatMessage: true }}, channel: true }
    })

    return this.cacheChatExperience(channelId, experienceTransaction)
  }

  public async addChatExperience (channelId: number, timestamp: number, xp: number, data: ChatExperienceData) {
    // don't allow backfilling or duplicates
    const prev = await this.getPreviousChatExperience(channelId)
    if (prev && (prev.time.getTime() > timestamp || prev.experienceDataChatMessage.chatMessage.youtubeId === data.chatMessageYtId)) {
      return
    }

    const experienceTransaction = await this.db.experienceTransaction.create({
      data: {
        time: new Date(timestamp),
        channel: { connect: { id: channelId }},
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

  public async addManualExperience (channelId: number, xp: number, message: string | null) {
    const experienceTransaction = await this.db.experienceTransaction.create({ data: {
      time: new Date(),
      channel: { connect: { id: channelId }},
      livestream: { connect: { id: this.livestreamStore.currentLivestream.id }},
      delta: xp,
      experienceDataAdmin: { create: {
        adminChannel: { connect: { youtubeId: ADMIN_YOUTUBE_ID }},
        message
      }}
    }})

    this.updateLastTransactionTime(experienceTransaction.time.getTime())
  }

  /** Returns the experience for the channel's snapshot, if it exists.
   * Note that snapshots are updated by running the RefreshSnapshots.ts script. */
  public getSnapshot (channelId: number): Promise<ExperienceSnapshot | null> {
    return this.db.experienceSnapshot.findFirst({
      where: { channel: { id: channelId }},
      orderBy: { time: 'desc' }
    })
  }

  /** Returns the sum of all of the channel's experience deltas between now and the given timestamp. */
  public async getTotalDeltaStartingAt (channelId: number, timestamp: number): Promise<number> {
    if (this.lastTransactionTime != null && timestamp > this.lastTransactionTime) {
      return 0
    }

    const result = await this.db.experienceTransaction.aggregate({
      where: {
        channel: { id: channelId },
        time: { gte: new Date(timestamp) }
      },
      _sum: { delta: true }
    })

    return result._sum?.delta ?? 0
  }

  /** Returns the transactions in ascending order. */
  public async getAllTransactionsStartingAt (timestamp: number): Promise<(ExperienceTransaction & { channel: { id: number }})[]> {
    if (this.lastTransactionTime != null && timestamp > this.lastTransactionTime) {
      return []
    }

    const transactions = await this.db.experienceTransaction.findMany({
      where: { time: { gte: new Date(timestamp) }},
      orderBy: { time: 'asc' },
      include: { channel: { select: { id: true }}}
    })

    // update cache
    if (transactions.length > 0) {
      const time = transactions.at(-1)!.time.getTime()
      this.updateLastTransactionTime(time)
    }

    return transactions
  }

  private cacheChatExperience (channelId: number, experienceTransaction: (Omit<ChatExperience, 'experienceDataChatMessage'> & { experienceDataChatMessage: (ExperienceDataChatMessage & { chatMessage: ChatMessage }) | null }) | null)
    : ChatExperience | null {
    let result: ChatExperience | null
    if (experienceTransaction) {
      result = {
        ...experienceTransaction,
        // no way to narrow this down using type guards... thanks typescript!
        experienceDataChatMessage: experienceTransaction.experienceDataChatMessage!
      }

      this.updateLastTransactionTime(experienceTransaction.time.getTime())
    } else {
      result = null
    }

    this.previousChatExperienceMap.set(channelId, result)
    return result
  }

  private updateLastTransactionTime (timestamp: number) {
    if (this.lastTransactionTime == null || timestamp > this.lastTransactionTime) {
      this.lastTransactionTime = timestamp
    }
  }
}
