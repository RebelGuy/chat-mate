import { Rank, RankName } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import LogService from '@rebel/server/services/LogService'
import RankStore, { AddUserRankArgs, RankEventData, RemoveUserRankArgs, UserRanks, UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { singleOrNull, unique } from '@rebel/shared/util/arrays'
import { ChatMateError, InvalidCustomRankError, UserRankAlreadyExistsError, UserRankNotFoundError } from '@rebel/shared/util/error'
import { isOneOf } from '@rebel/shared/util/validation'
import RankHelpers from '@rebel/shared/helpers/RankHelpers'
import UserService from '@rebel/server/services/UserService'
import { SafeExtract } from '@rebel/shared/types'
import EventDispatchService, { EVENT_PUBLIC_CHAT_MATE_EVENT_RANK_UPDATE } from '@rebel/server/services/EventDispatchService'

/** Non-special ranks that do not have specific constraints and are not associated with external platforms. */
export type RegularRank = SafeExtract<RankName, 'famous' | 'donator' | 'supporter' | 'member'>

export type ExternalRank = SafeExtract<RankName, 'mute' | 'timeout' | 'ban' | 'mod'>

export const ALL_RANK_NAMES = Object.keys(RankName) as RankName[] // RankName the const vs RankName the type. not confusing at all

export type CustomisableRank = SafeExtract<RankName, 'donator' | 'supporter' | 'member'>

const customisableRankNames: CustomisableRank[] = ['donator', 'supporter', 'member', 'famous'] as any

export type CombinedMergeResult = {
  individualResults: MergeResult[]

  /** The total number of warnings that were encountered while merging ranks. These may require admin attention. Log messages can befound by searching for the associated merge id. */
  warnings: number
}

export type MergeResult = {
  streamerId: number | null
  mergeId: string
  /** The ranks that were attached to the defaultUser before the merge, and are now revoked. */
  oldRanks: UserRankWithRelations[]

  // across the following 4 arrays, each type of rank is guaranteed to appear no more than once.
  /** The ranks that were added from the defaultUser to the aggregateUser. This happens only when the aggregateUser was not previously assigned this rank. */
  additions: UserRankWithRelations[]
  /** The ranks that were removed from the aggregateUser. This happens only when a rank name is specified in the `removeRanks` argument when calling `mergeRanks`. */
  removals: UserRankWithRelations[]
  /** The ranks that already existed on the aggregateUser, but had their expiry date extended. This happens when both users had the rank, but the defaultUser's rank expired later. */
  extensions: UserRankWithRelations[]
  /** The existing ranks of the aggregateUser that remained unchanged. This happens only when the aggregateUser was assigned a rank that the defaultUser did not have. */
  unchanged: UserRankWithRelations[]
}

/** Action ranks are ranks that have external meaning/are actionable externally. */
export type SetActionRankResult = {
  rankResult: InternalRankResult
  youtubeResults: YoutubeRankResult[]
  twitchResults: TwitchRankResult[]
}

export type InternalRankResult = { rank: UserRankWithRelations, error: null } | { rank: null, error: string }
export type YoutubeRankResult = { youtubeChannelId: number, error: string | null }
export type TwitchRankResult = { twitchChannelId: number, error: string | null }


type Deps = Dependencies<{
  rankStore: RankStore
  logService: LogService
  rankHelpers: RankHelpers
  userService: UserService
  eventDispatchService: EventDispatchService
}>

export default class RankService extends ContextClass {
  public readonly name = RankService.name

  private readonly rankStore: RankStore
  private readonly logService: LogService
  private readonly rankHelpers: RankHelpers
  private readonly userService: UserService
  private readonly eventDispatchService: EventDispatchService

  constructor (deps: Deps) {
    super()
    this.rankStore = deps.resolve('rankStore')
    this.logService = deps.resolve('logService')
    this.rankHelpers = deps.resolve('rankHelpers')
    this.userService = deps.resolve('userService')
    this.eventDispatchService = deps.resolve('eventDispatchService')
  }

  /** @throws {@link InvalidCustomRankNameError}: When the given custom rank name is invalid.
   *  @throws {@link InvalidCustomRankError}: When the given custom rank does not exist or is not customisable. */
  public async addOrUpdateCustomRankName (streamerId: number, primaryUserId: number, rankName: CustomisableRank, name: string, isActive: boolean): Promise<void> {
    if (await this.userService.isUserBusy(primaryUserId)) {
      throw new ChatMateError('Cannot set or update the rank name at this time. Please try again later.')
    }

    name = this.rankHelpers.validateCustomRankName(name)

    if (!ALL_RANK_NAMES.includes(rankName) || !customisableRankNames.includes(rankName)) {
      throw new InvalidCustomRankError(rankName)
    }

    await this.rankStore.addOrUpdateCustomRankName(streamerId, primaryUserId, rankName, name, isActive)
  }

  public async addRankEvent (streamerId: number, primaryUserId: number, appliedByPrimaryUserId: number | null, isAdded: boolean, rankName: RankName, data: RankEventData | null): Promise<void> {
    const rankEvent = await this.rankStore.addRankEvent(streamerId, primaryUserId, appliedByPrimaryUserId, isAdded, rankName, data)

    void this.eventDispatchService.addData(EVENT_PUBLIC_CHAT_MATE_EVENT_RANK_UPDATE, { streamerId, rankEvent })
  }

  public async getAccessibleRanks (): Promise<Rank[]> {
    const ranks = await this.rankStore.getRanks()

    // todo: CHAT-499 use logged-in user details to determine accessible ranks.
    // also create rank hierarchy, so that ranks have only access to ranks on an equal/lower level
    return ranks.filter(rank => isOneOf<RegularRank[]>(rank.name, 'famous', 'donator', 'member', 'supporter') || rank.group === 'punishment' || rank.name === 'mod')
  }

  /** Returns the list of ranks whose name can be customised. */
  public async getCustomisableRanks (): Promise<Rank[]> {
    const ranks = await this.rankStore.getRanks()
    return ranks.filter(rank => customisableRankNames.includes(rank.name as CustomisableRank))
  }

  /** Revokes the ranks of the first user if specified, and re-adds them to the second user.
   * Assumes the second user has no active ranks that would clash with the first user's ranks (if this does occur, these ranks will remain unchanged on the second user).
   * `ignoreRanks` specifies which ranks, if any, should not be transferred (note that they will still be revoked, if specified).
   * Returns the number of warnings.
  */
  public async transferRanks (fromUserId: number, toUserId: number, transferId: string, revokeAllOldRanks: boolean, ignoreRanks: RankName[]): Promise<number> {
    const ranks = await this.rankStore.getAllUserRanks(fromUserId)

    let warnings = 0

    for (const rank of ranks.ranks) {
      if (revokeAllOldRanks) {
        const removeArgs: RemoveUserRankArgs = {
          primaryUserId: fromUserId,
          message: `Revoked as part of rank transfer ${transferId} from user ${fromUserId} to user ${toUserId}`,
          rank: rank.rank.name,
          removedBy: null,
          streamerId: rank.streamerId
        }
        try {
          await this.rankStore.removeUserRank(removeArgs)
        } catch (e: any) {
          if (e instanceof UserRankNotFoundError) {
            this.logService.logWarning(this, `[Transfer ${transferId}] Cannot remove old rank ${rank.rank.name} from user ${fromUserId} for streamer ${rank.streamerId} because it doesn't exist`)
            warnings++
          } else {
            throw e
          }
        }
      }

      if (ignoreRanks.includes(rank.rank.name)) {
        continue
      }

      const addArgs: AddUserRankArgs = {
        primaryUserId: toUserId,
        message: `${rank.message} [Added as part of rank transfer ${transferId} from user ${fromUserId} to user ${toUserId}]`,
        rank: rank.rank.name,
        assignee: rank.assignedByUserId,
        streamerId: rank.streamerId,
        expirationTime: rank.expirationTime,
        time: new Date()
      }
      try {
        await this.rankStore.addUserRank(addArgs)
      } catch (e: any) {
        if (e instanceof UserRankAlreadyExistsError) {
          this.logService.logWarning(this, `[Transfer ${transferId}] Cannot add transferred rank ${rank.rank.name} to user ${toUserId} for streamer ${rank.streamerId} because it already exists`)
          warnings++
        } else {
          throw e
        }
      }
    }

    return warnings
  }

  /** Merges the ranks from the first user onto the second user.
   * If the aggregate user has a rank that the default user doesn't have, the aggregate user's rank will remain unchanged.
   * If both users have the same rank, but the default user's expiration is longer, the aggregate user will inherit the expiration.
   * `removeRanks` specifies which ranks should be removed on both users - they must manually be refreshed by the caller.
   * Returns the rank modifications to the aggregate user. */
  public async mergeRanks (defaultUser: number, aggregateUser: number, removeRanks: RankName[], mergeId: string): Promise<CombinedMergeResult> {
    const ranks1 = await this.rankStore.getAllUserRanks(defaultUser)
    const ranks2 = await this.rankStore.getAllUserRanks(aggregateUser)

    const streamerIds = unique([...ranks1.ranks.map(r => r.streamerId), ...ranks2.ranks.map(r => r.streamerId)])
    let results: MergeResult[] = []
    let warnings = 0

    for (const streamerId of streamerIds) {
      let oldRanks: UserRankWithRelations[] = []
      let additions: UserRankWithRelations[] = []
      let removals: UserRankWithRelations[] = []
      let extensions: UserRankWithRelations[] = []
      let unchanged: UserRankWithRelations[] = []

      for (const rankName of ALL_RANK_NAMES) {
        const oldRank = getRank(ranks1, streamerId, rankName)
        const baseRank = getRank(ranks2, streamerId, rankName)

        if (oldRank == null && baseRank == null) {
          continue
        }

        // if true, the rank of the first user should be copied over to the second user and overwrite the rank there, if it exists
        let requiresTransfer = false
        if (oldRank != null && baseRank == null) {
          requiresTransfer = true
        } else if (oldRank != null && baseRank != null) {
          if (oldRank.expirationTime == null && baseRank.expirationTime != null) {
            // new rank never expires, but base rank does
            requiresTransfer = true
          } else if (oldRank.expirationTime != null && baseRank.expirationTime != null && oldRank.expirationTime > baseRank.expirationTime) {
            // new rank expires after base rank
            requiresTransfer = true
          }
        }

        // always remove the default user's rank
        if (oldRank != null) {
          const removeArgs: RemoveUserRankArgs = {
            primaryUserId: defaultUser,
            message: `Revoked as part of rank merge ${mergeId} of user ${defaultUser} with user ${aggregateUser}`,
            rank: rankName,
            removedBy: null,
            streamerId: streamerId
          }
          try {
            const rank = await this.rankStore.removeUserRank(removeArgs)
            oldRanks.push(rank)
          } catch (e: any) {
            if (e instanceof UserRankNotFoundError) {
              this.logService.logWarning(this, `[Merge ${mergeId}] Cannot remove old rank ${rankName} from default user ${defaultUser} for streamer ${streamerId} because it doesn't exist`)
              warnings++
            } else {
              throw e
            }
          }
        }

        // if required, copy the default user's rank over
        if (requiresTransfer && !removeRanks.includes(rankName)) {
          if (baseRank != null) {
            try {
              const rank = await this.rankStore.updateRankExpiration(baseRank.id, oldRank!.expirationTime)
              extensions.push(rank)
            } catch (e: any) {
              if (e instanceof UserRankNotFoundError) {
                this.logService.logWarning(this, `[Merge ${mergeId}] Cannot update expiration for rank ${rankName} of aggregate user ${aggregateUser} for streamer ${streamerId} because it doesn't exist`)
                warnings++
              } else {
                throw e
              }
            }

          } else {
            const addArgs: AddUserRankArgs = {
              primaryUserId: aggregateUser,
              message: `Added as part of rank merge ${mergeId} of user ${defaultUser} with user ${aggregateUser}`,
              rank: rankName,
              assignee: oldRank!.assignedByUserId,
              streamerId: streamerId,
              expirationTime: oldRank!.expirationTime,
              time: new Date()
            }
            try {
              const rank = await this.rankStore.addUserRank(addArgs)
              additions.push(rank)
            } catch (e: any) {
              if (e instanceof UserRankAlreadyExistsError) {
                this.logService.logWarning(this, `[Merge ${mergeId}] Cannot add transferred rank ${rankName} to aggregate user ${aggregateUser} for streamer ${streamerId} because it already exists`)
                warnings++
              } else {
                throw e
              }
            }
          }

        } else if (removeRanks.includes(rankName) && baseRank != null) {
          const removeArgs: RemoveUserRankArgs = {
            primaryUserId: aggregateUser,
            message: `Revoked as part of rank merge ${mergeId} of user ${defaultUser} with user ${aggregateUser}`,
            rank: rankName,
            removedBy: null,
            streamerId: streamerId
          }
          try {
            const rank = await this.rankStore.removeUserRank(removeArgs)
            removals.push(rank)
          } catch (e: any) {
            if (e instanceof UserRankNotFoundError) {
              this.logService.logWarning(this, `[Merge ${mergeId}] Cannot remove rank ${rankName} from aggregate user ${aggregateUser} for streamer ${streamerId} because it doesn't exist`)
              warnings++
            } else {
              throw e
            }
          }

        } else if (baseRank != null) {
          unchanged.push(baseRank)
        }
      }

      results.push({ streamerId, mergeId, oldRanks, additions, removals, extensions, unchanged })
    }

    return { individualResults: results, warnings }
  }
}

function getRank (ranks: UserRanks, streamerId: number | null, name: RankName) {
  const filteredRanks = ranks.ranks.filter(r => r.streamerId === streamerId && r.rank.name === name)
  return singleOrNull(filteredRanks)
}
