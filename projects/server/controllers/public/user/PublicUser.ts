import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicUserRank } from '@rebel/server/controllers/public/rank/PublicUserRank'
import { PublicChannelInfo } from '@rebel/server/controllers/public/user/PublicChannelInfo'
import { PublicLevelInfo } from '@rebel/server/controllers/public/user/PublicLevelInfo'

export type PublicUser = PublicObject<3, {
  schema: 3

  /** The internal id of the user. */
  id: number

  /** Current information about the user. */
  userInfo: Tagged<1, PublicChannelInfo>

  /** Current level of the user. */
  levelInfo: Tagged<1, PublicLevelInfo>

  /** The list of active user-ranks, not sorted in any particular order. */
  activeRanks: PublicUserRank[]
}>
