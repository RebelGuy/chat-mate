import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicPunishment } from '@rebel/server/controllers/public/punishment/PublicPunishment'
import { PublicChannelInfo } from '@rebel/server/controllers/public/user/PublicChannelInfo'
import { PublicLevelInfo } from '@rebel/server/controllers/public/user/PublicLevelInfo'

export type PublicUser = PublicObject<2, {
  schema: 2

  /** The internal id of the user. */
  id: number

  /** Current information about the user. */
  userInfo: Tagged<1, PublicChannelInfo>

  /** Current level of the user. */
  levelInfo: Tagged<1, PublicLevelInfo>

  /** The list of active punishments, not sorted in any particular order. */
  activePunishments: PublicPunishment[]
}>
