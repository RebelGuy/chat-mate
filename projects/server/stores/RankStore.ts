import { Prisma, Rank, RankName, UserRank } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { group, subGroupedSingle } from '@rebel/server/util/arrays'

export type UserRanks = {
  userId: number
  ranks: UserRankWithRelations[]
}

export type UserRankWithRelations = Omit<UserRank, 'rankId' | 'id'> & {
  rank: Rank
}

export type AddUserRankArgs = {
  rank: RankName
  userId: number
  message: string | null

  // null if assigned by system
  assignee: number | null

  // null if the rank shouldn't expire
  expirationTime: Date | null
}

export type RemoveUserRankArgs = {
  rank: RankName
  userId: number
  message: string | null

  // null if removed by system
  removedBy: number | null
}

type Deps = Dependencies<{
  dbProvider: DbProvider
  dateTimeHelpers: DateTimeHelpers
}>

export default class RankStore extends ContextClass {
  private readonly db: Db
  private readonly dateTimeHelpers: DateTimeHelpers

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
  }

  /** Adds the rank to the user. Throws if a user-rank of that type is already active. */
  public async addUserRank (args: AddUserRankArgs) {
    // note: there is a BEFORE INSERT trigger in the `user_rank` table that ensures the user-rank doesn't already exist.
    // this avoids any potential race conditions that may arise if we were to check this server-side.

    await this.db.userRank.create({ data: {
      user: { connect: { id: args.userId }},
      rank: { connect: { name: args.rank }},
      issuedAt: this.dateTimeHelpers.now(),
      assignedByUser: args.assignee == null ? undefined : { connect: { id: args.assignee }},
      message: args.message,
      expirationTime: args.expirationTime
    }})
  }

  /** Gets the active ranks for each of the provided users. */
  public async getUserRanks (userIds: number[]): Promise<UserRanks[]> {
    const result = await this.db.userRank.findMany({
      where: {
        ...activeUserRankFilter,
        userId: { in: userIds },
      },
      include: { rank: true }
    })

    const groups = group(result, r => r.userId)
    return userIds.map(userId => ({
      userId: userId,
      ranks: groups.find(g => g.group === userId)?.items ?? []
    }))
  }

  /** Removes the rank from the user. Throws if no user-rank of that type is currently active. */
  public async removeUserRank (args: RemoveUserRankArgs) {
    const existing = await this.db.userRank.findFirst({
      where: {
        ...activeUserRankFilter,
        userId: args.userId,
        rank: { name: args.rank },
      },
      rejectOnNotFound: true,
      select: { id: true }
    })

    await this.db.userRank.update({
      where: { id: existing.id },
      data: {
        revokedTime: this.dateTimeHelpers.now(),
        revokeMessage: args.message,
        revokedByUserId: args.removedBy
      }
    })
  }
}

const activeUserRankFilter = Prisma.validator<Prisma.UserRankWhereInput>()({
  AND: [
    // the rank is not revoked
    { revokedTime: null },

    // and the rank hasn't expired yet
    { OR: [
      { expirationTime: null },
      { AND: [
        { NOT: { expirationTime: null }},
        { expirationTime: { gt: new Date() }}
      ]}
    ]}
  ]
})