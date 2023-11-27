import { PublicObject } from '@rebel/api-models/types'

export type PublicTwitchEventStatus = PublicObject<{
  /** The event type that this status object describes. */
  eventType: 'chat' | 'followers' | 'ban' | 'mod' | 'unban' | 'unmod' | 'streamStart' | 'streamEnd'

  /** The current status of the event. */
  status: 'active' | 'pending' | 'inactive'

  /** An optional error message. `null` implies that there is no error. */
  errorMessage: string | null

  /** The time at which this status has last changed or was generated. */
  lastChange: number

  /** If the subscription is not working properly, whether this can be fixed by obtaining (re-)authorisation from the streamer. */
  requiresAuthorisation: boolean
}>
