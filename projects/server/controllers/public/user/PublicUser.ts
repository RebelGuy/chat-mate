import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicChannelInfo } from '@rebel/server/controllers/public/user/PublicChannelInfo'
import { PublicLevelInfo } from '@rebel/server/controllers/public/user/PublicLevelInfo'

export type PublicUser = PublicObject<1, {
  schema: 1

  /** The internal id of the user. */
  id: number

  /** Current information about the user. */
  userInfo: PublicChannelInfo

  /** Current level of the user. */
  levelInfo: PublicLevelInfo
}>
