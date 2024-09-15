import { ChatMessage, ChatUser, ExperienceSnapshot, ExperienceTransaction, Prisma } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Entity } from '@rebel/server/models/entities'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { NoNulls } from '@rebel/shared/types'

export type ChatExperience =
  NoNulls<Pick<Entity.ExperienceTransaction, 'id' | 'time' | 'delta' | 'user' | 'experienceDataChatMessage'>>
  & { experienceDataChatMessage: { chatMessage: ChatMessage}, user: ChatUser }

export type ChatExperienceData = Pick<Entity.ExperienceDataChatMessage,
  'baseExperience' | 'viewershipStreakMultiplier' | 'participationStreakMultiplier' | 'spamMultiplier' | 'messageQualityMultiplier' | 'repetitionPenalty'>
  & { externalId: string }

export type UserExperience = { primaryUserId: number, experience: number }

type QueriedUserExperience = { primaryUserId: number, experience: Prisma.Decimal }

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export default class ExperienceStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
  }

  /** Returns the most recent chat experience or, if a transaction id is provided, the most recent chat experience before the given transaction.
   * May not be for the current livestream. */
  public async getPreviousChatExperience (streamerId: number, anyExactUserId: number, beforeTransactionId: number | null): Promise<ChatExperience | null> {
    const experienceTransaction = await this.db.experienceTransaction.findFirst({
      where: {
        streamerId: streamerId,
        userId: anyExactUserId,
        experienceDataChatMessage: { isNot: null },
        id: beforeTransactionId == null ? undefined : { lt: beforeTransactionId }
      },
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

  public async addChatExperience (streamerId: number, primaryUserId: number, timestamp: number, xp: number, data: ChatExperienceData) {
    // don't allow backfilling or duplicates
    const prev = await this.getPreviousChatExperience(streamerId, primaryUserId, null)
    if (prev != null && (prev.time.getTime() > timestamp || prev.experienceDataChatMessage.chatMessage.externalId === data.externalId)) {
      return
    }

    const experienceTransaction = await this.db.experienceTransaction.create({
      data: {
        time: new Date(timestamp),
        streamer: { connect: { id: streamerId }},
        user: { connect: { id: primaryUserId }},
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

  public async addManualExperience (streamerId: number, primaryUserId: number, adminUserId: number, xp: number, message: string | null) {
    await this.db.experienceTransaction.create({ data: {
      time: new Date(),
      streamerId: streamerId,
      userId: primaryUserId,
      delta: xp,
      experienceDataAdmin: { create: {
        adminUserId: adminUserId,
        message
      }}
    }})
  }

  /** Returns the experience for the user's snapshot, if it exists.
   * Note that snapshots are updated by running the RefreshSnapshots.ts script. */
  public getSnapshot (streamerId: number, primaryUserId: number): Promise<ExperienceSnapshot | null> {
    return this.db.experienceSnapshot.findFirst({
      where: { streamerId, userId: primaryUserId },
      orderBy: { time: 'desc' }
    })
  }

  /** Returns the sum of all of the user's experience deltas between now and the given timestamp. */
  public async getTotalDeltaStartingAt (streamerId: number, primaryUserId: number, timestamp: number): Promise<number> {
    const result = await this.db.experienceTransaction.aggregate({
      where: {
        streamerId,
        userId: primaryUserId,
        time: { gte: new Date(timestamp) }
      },
      _sum: { delta: true }
    })

    return result._sum?.delta ?? 0
  }

  public async getTotalGlobalExperience (since: number): Promise<number> {
    const queryResult = await this.db.experienceTransaction.aggregate({
      _sum: { delta: true },
      where: {
        NOT: { experienceDataChatMessage: null },
        time: { gte: new Date(since) }
      }
    })

    return queryResult._sum?.delta ?? 0
  }

  /** Gets the total experience of the specified users, sorted in descending order. */
  public async getExperience (streamerId: number, primaryUserIds: number[]): Promise<UserExperience[]> {
    if (primaryUserIds.length === 0) {
      return []
    }

    // for each user, sums the total experience since the last snapshot (if one exists), then
    // adds the snapshot experience to get the current total experience.
    // oof
    const result = await this.db.$queryRaw<QueriedUserExperience[]>`
      SELECT User.id AS primaryUserId, (COALESCE(SUM(TxsAfterSnap.xp), 0) + COALESCE(Snapshot.experience, 0)) AS experience
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
      WHERE User.id IN (${Prisma.join(primaryUserIds)})
      -- grouping required because of the aggregation 'SUM()' in the selection
      GROUP BY User.id, Snapshot.experience
      ORDER BY experience DESC;
    `

    return result.map(userExperience => ({
      primaryUserId: userExperience.primaryUserId,
      experience: userExperience.experience.toNumber()
    }))
  }

  /** Returns the transactions in ascending order. */
  public async getAllTransactionsStartingAt (streamerId: number, primaryUserIds: number[], timestamp: number): Promise<ExperienceTransaction[]> {
    return await this.db.experienceTransaction.findMany({
      where: {
        streamerId,
        time: { gte: new Date(timestamp) },
        userId: { in: primaryUserIds },
      },
      orderBy: { time: 'asc' }
    })
  }

  /** Gets all of the user's chat experience in the context of the given streamer. */
  public async getAllUserChatExperience (streamerId: number, primaryUserId: number): Promise<ChatExperience[]> {
    const transactions = await this.db.experienceTransaction.findMany({
      where: {
        userId: primaryUserId,
        streamerId: streamerId,
        experienceDataChatMessage: { isNot: null }
      },
      orderBy: { time: 'desc' },
      include: {
        experienceDataChatMessage: { include: { chatMessage: true }},
        user: true
      }
    })

    return transactions.map(tx => ({ ...tx, experienceDataChatMessage: tx.experienceDataChatMessage! }))
  }

  /** Gets all streamer ids for which the user has chat experience. */
  public async getChatExperienceStreamerIdsForUser (primaryUserId: number): Promise<number[]> {
    const transactions = await this.db.experienceTransaction.groupBy({
      by: ['streamerId'],
      where: {
        userId: primaryUserId,
        experienceDataChatMessage: { isNot: null }
      }
    })

    return transactions.map(tx => tx.streamerId)
  }

  /** Removes all snapshots across all streamers for the given users. */
  public async invalidateSnapshots (userIds: number[]) {
    await this.db.experienceSnapshot.deleteMany({
      where: { userId: { in: userIds } }
    })
  }

  /** Updates experience transactions (across all streamers) that originally linked to the `fromUserId` to point to the `toUserId`. */
  public async relinkChatExperience (fromUserId: number, toUserId: number) {
    await this.db.experienceTransaction.updateMany({
      where: { userId: fromUserId },
      data: {
        originalUserId: fromUserId,
        userId: toUserId
      }
    })

    await this.db.experienceDataAdmin.updateMany({
      where: { adminUserId: fromUserId },
      data: { adminUserId: toUserId }
    })
  }

  /** Updates experience transactions (across all streamers) that originally linked to the `fromUserId` to now point to that user again. */
  public async undoChatExperienceRelink (originalUserId: number) {
    await this.db.experienceTransaction.updateMany({
      where: { originalUserId: originalUserId },
      data: {
        originalUserId: null,
        userId: originalUserId
      }
    })
  }
}
