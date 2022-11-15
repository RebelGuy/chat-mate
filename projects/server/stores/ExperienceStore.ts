import { ChatMessage, ExperienceDataChatMessage, ExperienceSnapshot, ExperienceTransaction, Prisma } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { Entity } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import AdminService from '@rebel/server/services/rank/AdminService'
import { NoNulls } from '@rebel/server/types'
import { first } from '@rebel/server/util/arrays'

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
  adminService: AdminService
}>

export default class ExperienceStore extends ContextClass {
  private readonly db: Db
  private readonly adminService: AdminService

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
    this.adminService = deps.resolve('adminService')
  }

  // returns the previous chat experience, may not be for the current livestream
  public async getPreviousChatExperience (streamerId: number, userId: number): Promise<ChatExperience | null> {
    const experienceTransaction = await this.db.experienceTransaction.findFirst({
      where: { streamerId, userId, experienceDataChatMessage: { isNot: null }},
      orderBy: { time: 'desc' },
      include: { experienceDataChatMessage: { include: { chatMessage: true }}, user: true }
    })

    if (experienceTransaction == null) {
      return null
    } else {
      return {
        ...experienceTransaction,
        // the above query guarantees that this is not null, but the type doesn't reflect that
        experienceDataChatMessage: experienceTransaction.experienceDataChatMessage!
      }
    }
  }

  public async addChatExperience (streamerId: number, userId: number, timestamp: number, xp: number, data: ChatExperienceData) {
    // don't allow backfilling or duplicates
    const prev = await this.getPreviousChatExperience(streamerId, userId)
    if (prev != null && (prev.time.getTime() > timestamp || prev.experienceDataChatMessage.chatMessage.externalId === data.externalId)) {
      return
    }

    const experienceTransaction = await this.db.experienceTransaction.create({
      data: {
        time: new Date(timestamp),
        streamer: { connect: { id: streamerId }},
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

    if (experienceTransaction == null) {
      return null
    } else {
      return {
        ...experienceTransaction,
        // definitely not null because we just created it!
        experienceDataChatMessage: experienceTransaction.experienceDataChatMessage!
      }
    }
  }

  public async addManualExperience (streamerId: number, userId: number, xp: number, message: string | null) {
    const adminUser = first(await this.adminService.getAdminUsers(streamerId))
    const experienceTransaction = await this.db.experienceTransaction.create({ data: {
      time: new Date(),
      streamer: { connect: { id: streamerId }},
      user: { connect: { id: userId }},
      delta: xp,
      experienceDataAdmin: { create: {
        adminUser: { connect: { id: adminUser.id }},
        message
      }}
    }})
  }

  /** Returns the experience for the user's snapshot, if it exists.
   * Note that snapshots are updated by running the RefreshSnapshots.ts script. */
  public getSnapshot (streamerId: number, userId: number): Promise<ExperienceSnapshot | null> {
    return this.db.experienceSnapshot.findFirst({
      where: { streamerId, userId },
      orderBy: { time: 'desc' }
    })
  }

  /** Returns the sum of all of the user's experience deltas between now and the given timestamp. */
  public async getTotalDeltaStartingAt (streamerId: number, userId: number, timestamp: number): Promise<number> {
    const result = await this.db.experienceTransaction.aggregate({
      where: {
        streamerId,
        userId,
        time: { gte: new Date(timestamp) }
      },
      _sum: { delta: true }
    })

    return result._sum?.delta ?? 0
  }

  /** Gets the total experience of the specified users, sorted in descending order. */
  public async getExperience (streamerId: number, userIds: number[]): Promise<UserExperience[]> {
    if (userIds.length === 0) {
      return []
    }

    // for each user, sums the total experience since the last snapshot (if one exists), then
    // adds the snapshot experience to get the current total experience.
    // oof
    return await this.db.$queryRaw<UserExperience[]>`
      SELECT User.id AS userId, (COALESCE(SUM(TxsAfterSnap.xp), 0) + COALESCE(Snapshot.experience, 0)) AS experience
      FROM (
        SELECT * FROM experience_snapshot AS snapshot
        WHERE snapshot.streamerId = ${streamerId}
      ) AS Snapshot
      -- not all users are guaranteed to have snapshots - we generate a null-row by right joining the users table
      RIGHT JOIN chat_user User ON User.id = Snapshot.userId
      -- after the join, the new right entries might be null, meaning that a user hasn't had experience transacted since the snapshot on the left
      LEFT JOIN (
        -- this selects the total xp since the snapshot for each user that had experience transacted since the snapshot.
        -- if no snapshot exists, gets the total xp since the beginning of time
        SELECT tx.userId, SUM(delta) AS xp
        FROM experience_transaction AS tx
        LEFT JOIN (
          SELECT * FROM experience_snapshot AS InnerSnapshotTemp
          WHERE InnerSnapshotTemp.streamerId = ${streamerId}
        ) AS InnerSnapshot ON InnerSnapshot.userId = tx.userId
        WHERE tx.time > COALESCE(InnerSnapshot.time, 0) AND tx.streamerId = ${streamerId}
        GROUP BY tx.userId
      ) AS TxsAfterSnap ON TxsAfterSnap.userId = User.Id
      WHERE User.id IN (${Prisma.join(userIds)})
      -- grouping required because of the aggregation 'SUM()' in the selection
      GROUP BY User.id, Snapshot.experience
      ORDER BY experience DESC;
    `
  }

  /** Returns the transactions in ascending order. */
  public async getAllTransactionsStartingAt (streamerId: number, timestamp: number): Promise<ExperienceTransaction[]> {
    return await this.db.experienceTransaction.findMany({
      where: {
        streamerId,
        time: { gte: new Date(timestamp) }
      },
      orderBy: { time: 'asc' }
    })
  }
}
