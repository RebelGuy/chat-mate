import { Prisma, Rank, RankGroup, RankName, UserRank } from '@prisma/client'
import { PrismaClientInitializationError, PrismaClientKnownRequestError, PrismaClientUnknownRequestError, PrismaClientValidationError } from '@prisma/client/runtime'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { group, subGroupedSingle } from '@rebel/server/util/arrays'
import { UserRankAlreadyExistsError, UserRankNotFoundError } from '@rebel/server/util/error'

export type UserRanks = {
  userId: number
  ranks: UserRankWithRelations[]
}

export type UserRankWithRelations = Omit<UserRank, 'rankId'> & {
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

  /** Adds the rank to the user.
   * @throws {@link UserRankAlreadyExistsError}: When a user-rank of that type is already active.
   */
  public async addUserRank (args: AddUserRankArgs): Promise<UserRankWithRelations> {
    // note: there is a BEFORE INSERT trigger in the `user_rank` table that ensures the user-rank doesn't already exist.
    // this avoids any potential race conditions that may arise if we were to check this server-side.

    try {
      return await this.db.userRank.create({
        data: {
          user: { connect: { id: args.userId }},
          rank: { connect: { name: args.rank }},
          issuedAt: this.dateTimeHelpers.now(),
          assignedByUser: args.assignee == null ? undefined : { connect: { id: args.assignee }},
          message: args.message,
          expirationTime: args.expirationTime
        },
        include: { rank: true }
      })
    } catch (e: any) {
      // annoyingly we don't have access to the inner server object, as it is only included in serialised form in the message directly
      if (e instanceof PrismaClientUnknownRequestError && e.message.includes('DUPLICATE_RANK')) {
        throw new UserRankAlreadyExistsError(e.message)
      }

      throw e
    }
  }

  /** Gets the user rank that has the specified id.
   * @throws {@link UserRankNotFoundError}: When no user-rank with the given id is found. */
  public async getUserRankById (userRankId: number): Promise<UserRankWithRelations> {
    const result = await this.db.userRank.findUnique({
      where: { id: userRankId },
      include: { rank: true }
    })

    if (result == null) {
      throw new UserRankNotFoundError()
    } else {
      return result
    }
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

  public async getUserRanksForGroup (rankGroup: RankGroup): Promise<UserRankWithRelations[]> {
    return await this.db.userRank.findMany({
      where: {
        ...activeUserRankFilter,
        rank: { group: rankGroup }
      },
      include: { rank: true }
    })
  }

  /** Returns the user's rank history, sorted in descending order. */
  public async getUserRankHistory (userId: number): Promise<UserRankWithRelations[]> {
    return await this.db.userRank.findMany({
      where: { userId: userId },
      include: { rank: true },
      orderBy: { issuedAt: 'desc' }
    })
  }

  /** Removes the rank from the user.
   * @throws {@link UserRankNotFoundError}: When no user-rank of that type is currently active.
  */
  public async removeUserRank (args: RemoveUserRankArgs): Promise<UserRankWithRelations> {
    let existing: { id: number }
    try {
      existing = await this.db.userRank.findFirst({
        where: {
          ...activeUserRankFilter,
          userId: args.userId,
          rank: { name: args.rank },
        },
        rejectOnNotFound: true,
        select: { id: true }
      })
    } catch (e: any) {
      if (e.name === 'NotFoundError') {
        throw new UserRankNotFoundError(e.message)
      }

      throw e
    }

    return await this.db.userRank.update({
      where: { id: existing.id },
      data: {
        revokedTime: this.dateTimeHelpers.now(),
        revokeMessage: args.message,
        revokedByUserId: args.removedBy
      },
      include: { rank: true }
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

export function groupFilter (userRanks: UserRanks[], rankGroup: RankGroup): UserRanks[]
export function groupFilter (userRanks: UserRankWithRelations[], rankGroup: RankGroup): UserRankWithRelations[]
export function groupFilter (userRanks: UserRanks[] | UserRankWithRelations[], rankGroup: RankGroup) {
  if (userRanks.length === 0) {
    return []
  } else if (Object.keys(userRanks[0]).includes('ranks')) {
    return (userRanks as UserRanks[]).map(ur => ({
      userId: ur.userId,
      ranks: ur.ranks.filter(r => r.rank.group === rankGroup)
    }))
  } else {
    return (userRanks as UserRankWithRelations[]).filter(r => r.rank.group === rankGroup)
  }
}
