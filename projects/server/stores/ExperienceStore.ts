import { ChatMessage, ExperienceDataChatMessage, ExperienceSnapshot, ExperienceTransaction, Prisma } from '@prisma/client'
import { Sql } from '@prisma/client/runtime'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { Entity } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { ADMIN_YOUTUBE_ID } from '@rebel/server/stores/ChannelStore'
import { NoNulls } from '@rebel/server/types'
import { assertNotNull } from '@rebel/server/util/typescript'

export type ChatExperience =
  NoNulls<Pick<Entity.ExperienceTransaction, 'time' | 'delta' | 'user' | 'experienceDataChatMessage'>>
  & { experienceDataChatMessage: { chatMessage: ChatMessage} }

export type ChatExperienceData = Pick<Entity.ExperienceDataChatMessage,
  'baseExperience' | 'viewershipStreakMultiplier' | 'participationStreakMultiplier' | 'spamMultiplier' | 'messageQualityMultiplier' | 'repetitionPenalty'>
  & { externalId: string }

export type UserExperience = { userId: number, experience: number }

type ChatExperienceTransaction = ChatExperience & {
    experienceDataChatMessage: ExperienceDataChatMessage & { chatMessage: ChatMessage }
  }

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class ExperienceStore extends ContextClass {
  private readonly db: Db

  // key is userId
  // value is null if we know there is no data for a particular user
  private readonly previousChatExperienceMap: Map<number, ChatExperience | null>

  private ADMIN_USER_ID!: number

  // the timestamp cache of the last experience transaction for any user, if known
  private lastTransactionTime: number | null

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
    this.previousChatExperienceMap = new Map()
    this.lastTransactionTime = null
  }

  public override async initialise (): Promise<void> {
    const adminUser = await this.db.youtubeChannel.findUnique({
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
      include: { experienceDataChatMessage: { include: { chatMessage: true }}, user: true }
    })

    if (experienceTransaction != null) {
      assertNotNull(experienceTransaction, 'experienceDataChatMessage', `experienceDataChatMessage of the chat experience transaction ${experienceTransaction.id} is null`)
      return this.cacheChatExperience(userId, experienceTransaction)
    } else {
      return this.cacheChatExperience(userId, null)
    }
  }

  public async addChatExperience (userId: number, timestamp: number, xp: number, data: ChatExperienceData) {
    // don't allow backfilling or duplicates
    const prev = await this.getPreviousChatExperience(userId)
    if (prev && (prev.time.getTime() > timestamp || prev.experienceDataChatMessage.chatMessage.externalId === data.externalId)) {
      return
    }

    const experienceTransaction = await this.db.experienceTransaction.create({
      data: {
        time: new Date(timestamp),
        user: { connect: { id: userId }},
        delta: xp,
        experienceDataChatMessage: { create: {
          baseExperience: data.baseExperience,
          viewershipStreakMultiplier: data.viewershipStreakMultiplier,
          participationStreakMultiplier: data.participationStreakMultiplier,
          spamMultiplier: data.spamMultiplier,
          messageQualityMultiplier: data.messageQualityMultiplier,
          repetitionPenalty: data.repetitionPenalty,
          chatMessage: { connect: { externalId: data.externalId }}
        }}
      },
      include: { experienceDataChatMessage: { include: { chatMessage: true }}, user: true }
    })

    if (experienceTransaction != null) {
      assertNotNull(experienceTransaction, 'experienceDataChatMessage', `experienceDataChatMessage of the chat experience transaction ${experienceTransaction.id} is null`)
      return this.cacheChatExperience(userId, experienceTransaction)
    } else {
      return this.cacheChatExperience(userId, null)
    }
  }

  public async addManualExperience (userId: number, xp: number, message: string | null) {
    const experienceTransaction = await this.db.experienceTransaction.create({ data: {
      time: new Date(),
      user: { connect: { id: userId }},
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

  /** Gets the total experience of the specified users, sorted in descending order. */
  public async getExperience (userIds: number[]): Promise<UserExperience[]> {
    if (userIds.length === 0) {
      return []
    }

    // for each user, sums the total experience since the last snapshot (if one exists), then
    // adds the snapshot experience to get the current total experience. 
    return await this.db.$queryRaw<UserExperience[]>`
      SELECT User.id AS userId, (COALESCE(SUM(TxsAfterSnap.xp), 0) + COALESCE(Snapshot.experience, 0)) AS experience
      FROM experience_snapshot AS Snapshot
      # not all users are guaranteed to have snapshots - we generate a null-row by right joining the users table
      RIGHT JOIN chat_user User ON User.id = Snapshot.userId
      # after the join, the new right entries might be null, meaning that a user hasn't had experience transacted since the snapshot on the left
      LEFT JOIN (
        # this selects the total xp since the snapshot for each user that had experience transacted since the snapshot.
        # if no snapshot exists, gets the total xp since the beginning of time
        SELECT tx.userId, SUM(delta) AS xp
        FROM experience_transaction AS tx
        LEFT JOIN experience_snapshot AS InnerSnapshot ON InnerSnapshot.userId = tx.userId
        WHERE tx.time > COALESCE(InnerSnapshot.time, 0)
        GROUP BY tx.userId
      ) AS TxsAfterSnap ON TxsAfterSnap.userId = User.Id
      WHERE User.id IN (${Prisma.join(userIds)})
      # grouping required because of the aggregation 'SUM()' in the selection
      GROUP BY User.id, Snapshot.experience
      ORDER BY experience DESC;
    `
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

  private cacheChatExperience (userId: number, experienceTransaction: ChatExperienceTransaction | null) : ChatExperience | null {
    let result: ChatExperience | null
    if (experienceTransaction != null) {
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
