import { ChatMessage, ExperienceDataChatMessage, ExperienceSnapshot, ExperienceTransaction } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { Entity } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { ADMIN_YOUTUBE_ID } from '@rebel/server/stores/ChannelStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { NoNulls } from '@rebel/server/types'

export type ChatExperience =
  NoNulls<Pick<Entity.ExperienceTransaction, 'time' | 'delta' | 'user' | 'experienceDataChatMessage' | 'livestream'>>
  & { experienceDataChatMessage: { chatMessage: ChatMessage} }

export type ChatExperienceData = Pick<Entity.ExperienceDataChatMessage,
  'baseExperience' | 'viewershipStreakMultiplier' | 'participationStreakMultiplier' | 'spamMultiplier' | 'messageQualityMultiplier' | 'repetitionPenalty'>
  & { externalId: string }

type Deps = Dependencies<{
  dbProvider: DbProvider
  livestreamStore: LivestreamStore
}>

export default class ExperienceStore extends ContextClass {
  private readonly db: Db
  private readonly livestreamStore: LivestreamStore

  // key is userId
  // value is null if we know there is no data for a particular user
  private readonly previousChatExperienceMap: Map<number, ChatExperience | null>

  private ADMIN_USER_ID!: number

  // the timestamp cache of the last experience transaction for any user, if known
  private lastTransactionTime: number | null

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
    this.livestreamStore = deps.resolve('livestreamStore')
    this.previousChatExperienceMap = new Map()
    this.lastTransactionTime = null
  }

  public override async initialise (): Promise<void> {
    const adminUser = await this.db.channel.findUnique({
      where: { youtubeId: ADMIN_YOUTUBE_ID },
      rejectOnNotFound: true,
      select: { userId: true }
    })

    this.ADMIN_USER_ID = adminUser.userId
  }

  // returns the previous chat experience, may not be for the current livestream
  public async getPreviousChatExperience (userId: number): Promise<ChatExperience | null> {
    if (this.previousChatExperienceMap.has(userId)) {
      return this.previousChatExperienceMap.get(userId)!
    }

    const experienceTransaction = await this.db.experienceTransaction.findFirst({
      where: { user: { id: userId }, experienceDataChatMessage: { isNot: null }},
      orderBy: { time: 'desc' },
      include: { livestream: true, experienceDataChatMessage: { include: { chatMessage: true }}, user: true }
    })

    return this.cacheChatExperience(userId, experienceTransaction)
  }

  public async addChatExperience (userId: number, timestamp: number, xp: number, data: ChatExperienceData) {
    // don't allow backfilling or duplicates
    const prev = await this.getPreviousChatExperience(userId)
    if (prev && (prev.time.getTime() > timestamp || prev.experienceDataChatMessage.chatMessage.youtubeId === data.externalId)) {
      return
    }

    const experienceTransaction = await this.db.experienceTransaction.create({
      data: {
        time: new Date(timestamp),
        user: { connect: { id: userId }},
        livestream: { connect: { id: this.livestreamStore.currentLivestream.id }},
        delta: xp,
        experienceDataChatMessage: { create: {
          baseExperience: data.baseExperience,
          viewershipStreakMultiplier: data.viewershipStreakMultiplier,
          participationStreakMultiplier: data.participationStreakMultiplier,
          spamMultiplier: data.spamMultiplier,
          messageQualityMultiplier: data.messageQualityMultiplier,
          repetitionPenalty: data.repetitionPenalty,
          chatMessage: { connect: { youtubeId: data.externalId }}
        }}
      },
      include: { livestream: true, experienceDataChatMessage: { include: { chatMessage: true }}, user: true }
    })

    this.cacheChatExperience(userId, experienceTransaction)
  }

  public async addManualExperience (userId: number, xp: number, message: string | null) {
    const experienceTransaction = await this.db.experienceTransaction.create({ data: {
      time: new Date(),
      user: { connect: { id: userId }},
      livestream: { connect: { id: this.livestreamStore.currentLivestream.id }},
      delta: xp,
      experienceDataAdmin: { create: {
        adminUser: { connect: { id: this.ADMIN_USER_ID }},
        message
      }}
    }})

    this.updateLastTransactionTime(experienceTransaction.time.getTime())
  }

  /** Returns the experience for the user's snapshot, if it exists.
   * Note that snapshots are updated by running the RefreshSnapshots.ts script. */
  public getSnapshot (userId: number): Promise<ExperienceSnapshot | null> {
    return this.db.experienceSnapshot.findFirst({
      where: { user: { id: userId }},
      orderBy: { time: 'desc' }
    })
  }

  /** Returns the sum of all of the user's experience deltas between now and the given timestamp. */
  public async getTotalDeltaStartingAt (userId: number, timestamp: number): Promise<number> {
    if (this.lastTransactionTime != null && timestamp > this.lastTransactionTime) {
      return 0
    }

    const result = await this.db.experienceTransaction.aggregate({
      where: {
        user: { id: userId },
        time: { gte: new Date(timestamp) }
      },
      _sum: { delta: true }
    })

    return result._sum?.delta ?? 0
  }

  /** Returns the transactions in ascending order. */
  public async getAllTransactionsStartingAt (timestamp: number): Promise<ExperienceTransaction[]> {
    if (this.lastTransactionTime != null && timestamp > this.lastTransactionTime) {
      return []
    }

    const transactions = await this.db.experienceTransaction.findMany({
      where: { time: { gte: new Date(timestamp) }},
      orderBy: { time: 'asc' }
    })

    // update cache
    if (transactions.length > 0) {
      const time = transactions.at(-1)!.time.getTime()
      this.updateLastTransactionTime(time)
    }

    return transactions
  }

  private cacheChatExperience (userId: number, experienceTransaction: (Omit<ChatExperience, 'experienceDataChatMessage'> & { experienceDataChatMessage: (ExperienceDataChatMessage & { chatMessage: ChatMessage }) | null }) | null)
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

    this.previousChatExperienceMap.set(userId, result)
    return result
  }

  private updateLastTransactionTime (timestamp: number) {
    if (this.lastTransactionTime == null || timestamp > this.lastTransactionTime) {
      this.lastTransactionTime = timestamp
    }
  }
}
