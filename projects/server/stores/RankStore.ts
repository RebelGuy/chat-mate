import { Prisma, Rank, RankGroup, RankName, RegisteredUser, Streamer, UserRank } from '@prisma/client'
import { PrismaClientKnownRequestError, PrismaClientUnknownRequestError } from '@prisma/client/runtime'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import { group, unique } from '@rebel/server/util/arrays'
import { UserRankAlreadyExistsError, UserRankNotFoundError, UserRankRequiresStreamerError } from '@rebel/server/util/error'

export type UserRanks = {
  userId: number
  ranks: UserRankWithRelations[]
}

export type UserRankWithRelations = Omit<UserRank, 'rankId'> & {
  rank: Rank
  streamerName: string | null
}

export type AddUserRankArgs = {
  rank: RankName
  userId: number
  message: string | null

  // refer to the `GlobalRanks` constant to find out which ranks can have `streamerId = null`
  streamerId: number | null

  // null if assigned by system
  assignee: number | null

  // null if the rank shouldn't expire
  expirationTime: Date | null

  // optionally specify the reported time at which the rank was added. if not provided, uses the current time
  time?: Date
}

export type RemoveUserRankArgs = {
  rank: RankName
  userId: number
  streamerId: number | null
  message: string | null

  // null if removed by system
  removedBy: number | null
}

/** These ranks may not be associated with a specific streamer. */
const GlobalRanks: Record<RankName, boolean> = {
  admin: true,
  famous: true,
  ban: false,
  timeout: false,
  mute: false,
  mod: false,
  owner: false,
  donator: false,
  member: false,
  supporter: false
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
   * @throws {@link UserRankRequiresStreamerError}: When the user-rank is only valid in a streamer context, but no streamer name was provided.
   */
  public async addUserRank (args: AddUserRankArgs): Promise<UserRankWithRelations> {
    // note: there is a BEFORE INSERT trigger in the `user_rank` table that ensures the user-rank doesn't already exist.
    // this avoids any potential race conditions that may arise if we were to check this server-side.

    if (GlobalRanks[args.rank] === false && args.streamerId == null) {
      throw new UserRankRequiresStreamerError()
    }

    try {
      const result = await this.db.userRank.create({
        data: {
          user: { connect: { id: args.userId }},
          rank: { connect: { name: args.rank }},
          streamer: args.streamerId == null ? undefined : { connect: { id: args.streamerId } },
          issuedAt: args.time ?? this.dateTimeHelpers.now(),
          assignedByUser: args.assignee == null ? undefined : { connect: { id: args.assignee }},
          message: args.message,
          expirationTime: args.expirationTime
        },
        include: includeUserRankRelations
      })
      return rawDataToUserRankWithRelations(result)

    } catch (e: any) {
      // annoyingly we don't have access to the inner server object, as it is only included in serialised form in the message directly
      if (e instanceof PrismaClientUnknownRequestError && e.message.includes('DUPLICATE_RANK')) {
        throw new UserRankAlreadyExistsError(`The '${args.rank}' rank is already active for user ${args.userId}.`)
      }

      throw e
    }
  }

  /** Gets all ranks. */
  public async getRanks (): Promise<Rank[]> {
    return await this.db.rank.findMany()
  }

  /** Gets the user rank that has the specified id.
   * @throws {@link UserRankNotFoundError}: When no user-rank with the given id is found. */
  public async getUserRankById (userRankId: number): Promise<UserRankWithRelations> {
    const result = await this.db.userRank.findUnique({
      where: { id: userRankId },
      include: includeUserRankRelations
    })

    if (result == null) {
      throw new UserRankNotFoundError(`Could not find a user-rank with ID ${userRankId}.`)
    } else {
      return rawDataToUserRankWithRelations(result)
    }
  }

  /** Gets the active ranks for each of the provided users in the context of the streamer id. Note that global ranks are always returned, where applicable. */
  public async getUserRanks (userIds: number[], streamerId: number | null): Promise<UserRanks[]> {
    const result = await this.db.userRank.findMany({
      where: {
        ...activeUserRankFilter(streamerId),
        userId: { in: userIds },
      },
      include: includeUserRankRelations
    })

    const groups = group(result.map(rawDataToUserRankWithRelations), r => r.userId)
    return unique(userIds).map(userId => ({
      userId: userId,
      ranks: groups.find(g => g.group === userId)?.items ?? []
    }))
  }

  /** Gets the active user-ranks that are part of the given group in the context of the streamer id. Note that global ranks are always returned, where applicable. */
  public async getUserRanksForGroup (rankGroup: RankGroup, streamerId: number | null): Promise<UserRankWithRelations[]> {
    const result = await this.db.userRank.findMany({
      where: {
        ...activeUserRankFilter(streamerId),
        rank: { group: rankGroup }
      },
      include: includeUserRankRelations
    })

    return result.map(rawDataToUserRankWithRelations)
  }

  /** Returns the user's rank history in the context of the streamer id, sorted in descending order. Note that global ranks are always returned, where applicable. */
  public async getUserRankHistory (userId: number, streamerId: number | null): Promise<UserRankWithRelations[]> {
    const result = await this.db.userRank.findMany({
      where: {
        userId: userId,
        OR: [
          { streamerId: null },
          { streamerId: streamerId }
        ]
      },
      include: includeUserRankRelations,
      orderBy: { issuedAt: 'desc' }
    })

    return result.map(rawDataToUserRankWithRelations)
  }

  /** Removes the rank from the user in the context of the streamer.
   * @throws {@link UserRankNotFoundError}: When no user-rank of that type is currently active.
  */
  public async removeUserRank (args: RemoveUserRankArgs): Promise<UserRankWithRelations> {
    let existing: { id: number }
    try {
      existing = await this.db.userRank.findFirst({
        where: {
          ...activeUserRankFilter(args.streamerId),
          streamerId: args.streamerId, // override filter - the streamerId must match exactly
          userId: args.userId,
          rank: { name: args.rank },
        },
        rejectOnNotFound: true,
        select: { id: true }
      })
    } catch (e: any) {
      if (e.name === 'NotFoundError') {
        throw new UserRankNotFoundError(`Could not find an active '${args.rank}' rank for user ${args.userId} in the context of streamer ${args.streamerId}.`)
      }

      throw e
    }

    const result = await this.db.userRank.update({
      where: { id: existing.id },
      data: {
        revokedTime: this.dateTimeHelpers.now(),
        revokeMessage: args.message,
        revokedByUserId: args.removedBy
      },
      include: includeUserRankRelations
    })

    return rawDataToUserRankWithRelations(result)
  }

  /** Sets the expiration time for the given user-rank.
   * @throws {@link UserRankNotFoundError}: When the user-rank was not found.
  */
  public async updateRankExpiration (rankId: number, newExpiration: Date | null) {
    try {
      return await this.db.userRank.update({
        where: { id: rankId },
        data: { expirationTime: newExpiration }
      })
    } catch (e: any) {
      // https://www.prisma.io/docs/reference/api-reference/error-reference#p2025
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new UserRankNotFoundError(`Could not update expiration for rank ${rankId} because it does not exist.`)
      }

      throw e
    }
  }
}

const activeUserRankFilter = (streamerId: number | null) => Prisma.validator<Prisma.UserRankWhereInput>()({
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
    ]},

    // include global ranks and ranks for the given streamer context
    { OR: [
      { streamerId: null },
      { streamerId: streamerId }
    ]}
  ]
})

const includeUserRankRelations = Prisma.validator<Prisma.UserRankInclude>()({
  rank: true,
  streamer: { include: { registeredUser: true }}
})

type RawResult = UserRank & {
  rank: Rank
  streamer: (Streamer & { registeredUser: RegisteredUser }) | null
}

function rawDataToUserRankWithRelations (data: RawResult): UserRankWithRelations {
  return {
    id: data.id,
    assignedByUserId: data.assignedByUserId,
    expirationTime: data.expirationTime,
    issuedAt: data.issuedAt,
    message: data.message,
    rank: data.rank,
    revokedByUserId: data.revokedByUserId,
    revokedTime: data.revokedTime,
    revokeMessage: data.revokeMessage,
    userId: data.userId,
    streamerId: data.streamerId,
    streamerName: data.streamer?.registeredUser.username ?? null
  }
}

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
