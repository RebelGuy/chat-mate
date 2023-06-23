import { PublicObject } from '@rebel/api-models/types'
import { PublicUserRank } from '@rebel/api-models/public/rank/PublicUserRank'
import { PublicChannel } from '@rebel/api-models/public/user/PublicChannel'
import { PublicLevelInfo } from '@rebel/api-models/public/user/PublicLevelInfo'
import { PublicRegisteredUser } from '@rebel/api-models/public/user/PublicRegisteredUser'

export type PublicUser = PublicObject<{
  /** The internal primary ID of the user. */
  primaryUserId: number

  /** The registered account that is linked to this user, if any. */
  registeredUser: PublicRegisteredUser | null

  /** Current information about the user's active channel. */
  channel: PublicChannel

  /** Current level of the user. */
  levelInfo: PublicLevelInfo

  /** The list of active user-ranks, not sorted in any particular order. */
  activeRanks: PublicUserRank[]

  /** The timestamp at which the user has posted their first message. */
  firstSeen: number
}>
