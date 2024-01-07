import { PublicObject } from '@rebel/api-models/types'

export type PublicLivestream = PublicObject<{
  /** The internal ID of the livestream. */
  id: number

  /** Whether this is a Youtube or Twitch livestream. */
  platform: 'youtube' | 'twitch'

  /** Link to the external watch page of the livestream. */
  livestreamLink: string

  /** The current status of the livestream. Never "not_started" for Twitch livestreams. */
  status: 'not_started' | 'live' | 'finished'

  /** The start timestamp of the livestream. Null if status is `not_started`. Never null for Twitch livestreams. */
  startTime: number | null

  /** The end timestamp of the livestream. Null if status is not `finished`. */
  endTime: number | null
}>
