import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicLevelUpData } from '@rebel/server/controllers/public/event/PublicLevelUpData'
import { PublicNewTwitchFollowerData } from '@rebel/server/controllers/public/event/PublicNewTwitchFollowerData'

export type PublicChatMateEvent = PublicObject<3, {
  schema: 3

  /** The type of event that has occurred. */
  type: 'levelUp' | 'newTwitchFollower'

  /** The time at which the event occurred. */
  timestamp: number

  /** Only set if `type` is `levelUp`. */
  levelUpData: Tagged<2, PublicLevelUpData> | null

  /** Only set if `type` is `newTwitchFollower`. */
  newTwitchFollowerData: Tagged<1, PublicNewTwitchFollowerData> | null
}>
