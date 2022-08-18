import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicDonationData } from '@rebel/server/controllers/public/event/PublicDonationData'
import { PublicLevelUpData } from '@rebel/server/controllers/public/event/PublicLevelUpData'
import { PublicNewTwitchFollowerData } from '@rebel/server/controllers/public/event/PublicNewTwitchFollowerData'

export type PublicChatMateEvent = PublicObject<5, {
  schema: 5

  /** The type of event that has occurred. */
  type: 'levelUp' | 'newTwitchFollower' | 'donation'

  /** The time at which the event occurred. */
  timestamp: number

  /** Only set if `type` is `levelUp`. */
  levelUpData: Tagged<3, PublicLevelUpData> | null

  /** Only set if `type` is `newTwitchFollower`. */
  newTwitchFollowerData: Tagged<1, PublicNewTwitchFollowerData> | null

  /** Only set if `type` is `donation`. */
  donationData: Tagged<1, PublicDonationData> | null
}>
