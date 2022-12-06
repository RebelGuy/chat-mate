import { Rank, RankName } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs, UserRanks, UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { singleOrNull, unique } from '@rebel/server/util/arrays'
import { randomString } from '@rebel/server/util/random'
import { isOneOf } from '@rebel/server/util/validation'

/** Non-special ranks that do not have specific constraints and are not associated with external platforms. */
export type RegularRank = Extract<RankName, 'famous' | 'donator' | 'supporter' | 'member'>

const rankNames = Object.keys(RankName) as RankName[] // RankName the const vs RankName the type. not confusing at all

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
}>

export default class RankService extends ContextClass {
  private readonly rankStore: RankStore

  constructor (deps: Deps) {
    super()

    this.rankStore = deps.resolve('rankStore')
  }

  public async getAccessibleRanks (): Promise<Rank[]> {
    const ranks = await this.rankStore.getRanks()

    // todo: CHAT-499 use logged-in user details to determine accessible ranks.
    // also create rank hierarchy, so that ranks have only access to ranks on an equal/lower level
    return ranks.filter(rank => isOneOf<RegularRank[]>(rank.name, 'famous', 'donator', 'member', 'supporter') || rank.group === 'punishment' || rank.name === 'mod')
  }

  /** Revokes the ranks of the first user, and re-adds them to the second user. */
  public async transferRanks (fromUserId: number, toUserId: number): Promise<void> {
    const ranks = await this.rankStore.getAllUserRanks(fromUserId)

    // reference a common id so we can more easily reconciliate data later on
    const transferId = randomString(8)
    for (const rank of ranks.ranks) {
      // we don't strictly need to revoke the old user's ranks, as we will never query those while the new link is in place.
      // however, if we ever were to unlink the user, it's easier to start from a clean state where the original user has not active ranks associated with it.
      const removeArgs: RemoveUserRankArgs = {
        chatUserId: fromUserId,
        message: `Revoked as part of rank transfer ${transferId} from user ${fromUserId} to user ${toUserId}`,
        rank: rank.rank.name,
        removedBy: null,
        streamerId: rank.streamerId
      }
      await this.rankStore.removeUserRank(removeArgs)

      const addArgs: AddUserRankArgs = {
        chatUserId: toUserId,
        message: `Added as part of rank transfer ${transferId} from user ${fromUserId} to user ${toUserId}`,
        rank: rank.rank.name,
        assignee: rank.assignedByRegisteredUserId,
        streamerId: rank.streamerId,
        expirationTime: rank.expirationTime,
        time: new Date()
      }
      await this.rankStore.addUserRank(addArgs)
    }
  }

  /** Merges the ranks from the first user onto the second user.
   * If the aggregate user has a rank that the default user doesn't have, the default user will inherit that rank.
   * If both users have the same rank, but the default user's expiration is longer, the aggregate user will inherit the expiration.
   * `removeRanks` specifies which ranks should be removed on both users - they must manually be refreshed by the caller.
   * Returns the rank modifications to the aggregate user. */
  public async mergeRanks (defaultUser: number, aggregateUser: number, removeRanks: RankName[]): Promise<MergeResult[]> {
    const ranks1 = await this.rankStore.getAllUserRanks(defaultUser)
    const ranks2 = await this.rankStore.getAllUserRanks(aggregateUser)

    const streamerIds = unique([...ranks1.ranks.map(r => r.streamerId), ...ranks2.ranks.map(r => r.streamerId)])
    let result: MergeResult[] = []

    // reference a common id so we can more easily reconciliate data later on
    const mergeId = randomString(8)

    for (const streamerId of streamerIds) {
      let oldRanks: UserRankWithRelations[] = []
      let additions: UserRankWithRelations[] = []
      let removals: UserRankWithRelations[] = []
      let extensions: UserRankWithRelations[] = []
      let unchanged: UserRankWithRelations[] = []

      for (const rankName of rankNames) {
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
            chatUserId: defaultUser,
            message: `Revoked as part of rank merge ${mergeId} of user ${defaultUser} with user ${aggregateUser}`,
            rank: rankName,
            removedBy: null,
            streamerId: streamerId
          }
          const rank = await this.rankStore.removeUserRank(removeArgs)
          oldRanks.push(rank)
        }

        // if required, copy the default user's rank over
        if (requiresTransfer && !removeRanks.includes(rankName)) {
          if (baseRank != null) {
            const rank = await this.rankStore.updateRankExpiration(baseRank.id, oldRank!.expirationTime)
            extensions.push(rank)

          } else {
            const addArgs: AddUserRankArgs = {
              chatUserId: aggregateUser,
              message: `Added as part of rank merge ${mergeId} of user ${defaultUser} with user ${aggregateUser}`,
              rank: rankName,
              assignee: oldRank!.assignedByRegisteredUserId,
              streamerId: streamerId,
              expirationTime: oldRank!.expirationTime,
              time: new Date()
            }
            const rank = await this.rankStore.addUserRank(addArgs)
            additions.push(rank)
          }

        } else if (removeRanks.includes(rankName)) {
          const removeArgs: RemoveUserRankArgs = {
            chatUserId: aggregateUser,
            message: `Revoked as part of rank merge ${mergeId} of user ${defaultUser} with user ${aggregateUser}`,
            rank: rankName,
            removedBy: null,
            streamerId: streamerId
          }
          const rank = await this.rankStore.removeUserRank(removeArgs)
          removals.push(rank)

        } else {
          unchanged.push(baseRank!)
        }
      }

      result.push({ streamerId, mergeId, oldRanks, additions, removals, extensions, unchanged })
    }

    return result
  }
}

function getRank (ranks: UserRanks, streamerId: number | null, name: RankName) {
  const filteredRanks = ranks.ranks.filter(r => r.streamerId === streamerId && r.rank.name === name)
  return singleOrNull(filteredRanks)
}
