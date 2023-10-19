import { PublicObject } from '@rebel/api-models/types'
import { PublicDonationData } from '@rebel/api-models/public/event/PublicDonationData'
import { PublicLevelUpData } from '@rebel/api-models/public/event/PublicLevelUpData'
import { PublicNewTwitchFollowerData } from '@rebel/api-models/public/event/PublicNewTwitchFollowerData'
import { PublicNewViewerData } from '@rebel/api-models/public/event/PublicNewViewerData'
import { PublicChatMessageDeletedData } from '@rebel/api-models/public/event/PublicChatMessageDeletedData'

export type PublicChatMateEvent = PublicObject<{
  /** The type of event that has occurred. */
  type: 'levelUp' | 'newTwitchFollower' | 'donation' | 'newViewer' | 'chatMessageDeleted'

  /** The time at which the event occurred. */
  timestamp: number

  /** Only set if `type` is `levelUp`. */
  levelUpData: PublicObject<PublicLevelUpData> | null

  /** Only set if `type` is `newTwitchFollower`. */
  newTwitchFollowerData: PublicObject<PublicNewTwitchFollowerData> | null

  /** Only set if `type` is `donation`. */
  donationData: PublicObject<PublicDonationData> | null

  /** Only set if `type` is `newViewer`. */
  newViewerData: PublicNewViewerData | null

  /** Only set if `type` is `chatMessageDeleted`. */
  chatMessageDeletedData: PublicChatMessageDeletedData | null
}>
