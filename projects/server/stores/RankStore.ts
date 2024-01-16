import { Prisma, Rank, RankEvent, RankGroup, RankName, RegisteredUser, Streamer, UserRank } from '@prisma/client'
import { PrismaClientKnownRequestError, PrismaClientUnknownRequestError } from '@prisma/client/runtime'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import DbProvider, { Db, isKnownPrismaError, isNotFoundPrismaError, isUnknownPrismaError } from '@rebel/server/providers/DbProvider'
import { group, toObject, unique } from '@rebel/shared/util/arrays'
import { ChatMateError, NotFoundError, UserRankAlreadyExistsError, UserRankNotFoundError, UserRankRequiresStreamerError } from '@rebel/shared/util/error'
import { IgnoreOptions } from '@rebel/server/services/rank/PunishmentService'
import { TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import { SafeOmit } from '@rebel/shared/types'

export type UserRanks = {
  primaryUserId: number
  ranks: UserRankWithRelations[]
}

export type UserRankWithRelations = SafeOmit<UserRank, 'rankId' | 'userId'> & {
  primaryUserId: number
  rank: Rank
  streamerName: string | null
}

export type AddUserRankArgs = {
  rank: RankName
  primaryUserId: number
  message: string | null

  /** refer to the `GlobalRanks` constant to find out which ranks can have `streamerId = null` */
  streamerId: number | null

  /** primary user id, `null` if assigned by system */
  assignee: number | null

  /** `null` if the rank shouldn't expire */
  expirationTime: Date | null

  /** optionally specify the reported time at which the rank was added. if not provided, uses the current time */
  time?: Date
}

export type RankEventData = {
  version: 1
  youtubeRankResults: YoutubeRankResult[]
  twitchRankResults: TwitchRankResult[]

  // the rank was not explicitly applied to this channel by ChatMate,
  // but it is understood that the rank was applied by some other entity externally
  ignoreOptions: IgnoreOptions | null
}

export type ParsedRankEvent = SafeOmit<RankEvent, 'serialisedData'> & {
  data: RankEventData | null
  rank: Rank
}

export type RemoveUserRankArgs = {
  rank: RankName
  primaryUserId: number
  streamerId: number | null
  message: string | null

  /** primary user id, `null` if removed by system */
  removedBy: number | null
}

export type CustomRankNames = {
  primaryUserId: number
  customRankNames: Partial<Record<RankName, string>>
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

  public async addOrUpdateCustomRankName (streamerId: number, primaryUserId: number, rankName: RankName, customName: string, isActive: boolean): Promise<void> {
    const existing = await this.db.customRankName.findFirst({
      where: {
        streamerId: streamerId,
        userId: primaryUserId,
        rank: { name: rankName }
      }
    })

    if (existing != null) {
      await this.db.customRankName.update({
        where: { id: existing.id },
        data: {
          name: customName,
          isActive: isActive
        }
      })
    } else {
      const rank = await this.db.rank.findFirst({ where: { name: rankName } })
      await this.db.customRankName.create({ data: {
        streamerId: streamerId,
        userId: primaryUserId,
        rankId: rank!.id,
        name: customName,
        isActive: isActive
      }})
    }
  }

  public async addRankEvent (streamerId: number, primaryUserId: number, isAdded: boolean, rankName: RankName, data: RankEventData | null) {
    const rank = await this.db.rank.findUnique({ where: { name: rankName }})

    await this.db.rankEvent.create({ data: {
      streamerId: streamerId,
      userId: primaryUserId,
      isAdded: isAdded,
      rankId: rank!.id,

      // deliberately don't truncate the string, else we might be saving an invalid json object that can't be parsed
      serialisedData: data == null ? null : JSON.stringify(data)
    }})
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
          user: { connect: { id: args.primaryUserId }},
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
      if (isUnknownPrismaError(e) && e.innerError.message.includes('DUPLICATE_RANK')) {
        throw new UserRankAlreadyExistsError(`The '${args.rank}' rank is already active for chat user ${args.primaryUserId}.`)
      }

      throw e
    }
  }

  public async deleteCustomRankName (streamerId: number, primaryUserId: number, rankName: RankName): Promise<void> {
    const existing = await this.db.customRankName.findFirst({
      where: {
        streamerId: streamerId,
        userId: primaryUserId,
        rank: { name: rankName }
      }
    })

    if (existing == null) {
      throw new NotFoundError('Could not find a custom rank name.')
    }

    await this.db.customRankName.delete({ where: { id: existing.id }})
  }

  /** Returns all active custom rank names by the specified users. */
  public async getCustomRankNamesForUsers (streamerId: number | null, primaryUserIds: number[]): Promise<CustomRankNames[]> {
    const results = await this.db.customRankName.findMany({
      where: {
        streamerId: streamerId,
        userId: { in: primaryUserIds },
        isActive: true
      },
      select: {
        userId: true,
        name: true,
        rank: { select: { name: true }}
      }
    })

    const groups = group(results, item => item.userId)
    return primaryUserIds.map(userId => {
      const groupForUser = groups.find(g => g.group === userId)

      return {
        primaryUserId: userId,
        customRankNames: groupForUser != null ? toObject(groupForUser.items, item => [item.rank.name, item.name]) : {}
      }
    })
  }

  /** Gets all ranks. */
  public async getRanks (): Promise<Rank[]> {
    return await this.db.rank.findMany()
  }

  public async getRankEventsSince (streamerId: number, since: number): Promise<ParsedRankEvent[]> {
    const rankEvents = await this.db.rankEvent.findMany({
      where: {
        streamerId: streamerId,
        time: { gt: new Date(since) }
      },
      include: {
        rank: true
      }
    })

    return rankEvents.map(event => {
      const data: RankEventData | null = event.serialisedData == null ? null : JSON.parse(event.serialisedData)
      if (data != null && data.version !== 1) {
        throw new ChatMateError(`Invalid rank event data version ${data.version}. Expected 1.`)
      }

      return {
        id: event.id,
        isAdded: event.isAdded,
        rankId: event.rankId,
        rank: event.rank,
        streamerId: event.streamerId,
        time: event.time,
        userId: event.userId,
        data: data
      }
    })
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

  /** Gets the active ranks for each of the provided users in the context of the streamer id. Note that global ranks are always returned, where applicable. Only glohbal ranks are returned if `streamerId` is `null`. */
  public async getUserRanks (primaryUserIds: number[], streamerId: number | null): Promise<UserRanks[]> {
    primaryUserIds = unique(primaryUserIds)

    const result = await this.db.userRank.findMany({
      where: {
        ...activeUserRankFilter(streamerId),
        userId: { in: primaryUserIds },
      },
      include: includeUserRankRelations
    })

    const groups = group(result.map(rawDataToUserRankWithRelations), r => r.primaryUserId)
    return primaryUserIds.map(primaryUserId => ({
      primaryUserId: primaryUserId,
      ranks: groups.find(g => g.group === primaryUserId)?.items ?? []
    }))
  }

  /** Gets the active ranks for the exact user, for all streamers and global ranks. Does not take into account user links. */
  public async getAllUserRanks (primaryUserId: number): Promise<UserRanks> {
    const result = await this.db.userRank.findMany({
      where: {
        ...activeUserRankFilter(),
        userId: primaryUserId,
      },
      include: includeUserRankRelations
    })

    return {
      primaryUserId: primaryUserId,
      ranks: result.map(rawDataToUserRankWithRelations)
    }
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
  public async getUserRankHistory (primaryUserId: number, streamerId: number | null): Promise<UserRankWithRelations[]> {
    const result = await this.db.userRank.findMany({
      where: {
        userId: primaryUserId,
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

  public async relinkAdminUsers (fromUserId: number, toUserId: number) {
    await this.db.userRank.updateMany({
      where: { assignedByUserId: fromUserId },
      data: { assignedByUserId: toUserId }
    })

    await this.db.userRank.updateMany({
      where: { revokedByUserId: fromUserId },
      data: { revokedByUserId: toUserId }
    })
  }

  public async relinkCustomRankNames (fromUserId: number, toUserId: number) {
    await this.db.customRankName.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId }
    })
  }

  public async relinkRankEvents (formUserId: number, toUserId: number) {
    await this.db.rankEvent.updateMany({
      where: { userId: formUserId },
      data: { userId: toUserId }
    })
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
          userId: args.primaryUserId,
          rank: { name: args.rank },
        },
        rejectOnNotFound: true,
        select: { id: true }
      })
    } catch (e: any) {
      if (isNotFoundPrismaError(e)) {
        throw new UserRankNotFoundError(`Could not find an active '${args.rank}' rank for chat user ${args.primaryUserId} in the context of streamer ${args.streamerId}.`)
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
  public async updateRankExpiration (rankId: number, newExpiration: Date | null): Promise<UserRankWithRelations> {
    try {
      const result = await this.db.userRank.update({
        where: { id: rankId },
        data: { expirationTime: newExpiration },
        include: includeUserRankRelations
      })

      return rawDataToUserRankWithRelations(result)
    } catch (e: any) {
      // https://www.prisma.io/docs/reference/api-reference/error-reference#p2025
      if (isKnownPrismaError(e) && e.innerError.code === 'P2025') {
        throw new UserRankNotFoundError(`Could not update expiration for rank ${rankId} because it does not exist.`)
      }

      throw e
    }
  }
}

/** If `streamerId` is a number, matches only active ranks in the context of the streamer, and global ranks.
 * If `streamerId` is null, matches only global ranks.
 * If `streamerId` is `undefined`, will match ALL ranks across all streamers, and global ranks. */
const activeUserRankFilter = (streamerId?: number | null) => Prisma.validator<Prisma.UserRankWhereInput>()({
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
    { OR: streamerId === undefined ? [] : [
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
    primaryUserId: data.userId,
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
      primaryUserId: ur.primaryUserId,
      ranks: ur.ranks.filter(r => r.rank.group === rankGroup)
    }))
  } else {
    return (userRanks as UserRankWithRelations[]).filter(r => r.rank.group === rankGroup)
  }
}
