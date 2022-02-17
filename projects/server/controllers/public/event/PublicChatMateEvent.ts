import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicLevelUpData } from '@rebel/server/controllers/public/event/PublicLevelUpData'

export type PublicChatMateEvent = PublicObject<1, {
  schema: 1

  /** The type of event that has occurred. */
  type: 'levelUp'

  /** The time at which the event occurred. */
  timestamp: number

  /** Data related to the current event type. */
  data: PublicLevelUpData
}>
