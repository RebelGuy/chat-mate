import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicTwitchEventStatus = PublicObject<{
  /** The event type that this status object describes. */
  eventType: 'chat' | 'followers'

  /** The current status of the event. */
  status: 'active' | 'pending' | 'inactive'

  /** An optional error message. `null` implies that there is no error. */
  errorMessage: string | null
}>
