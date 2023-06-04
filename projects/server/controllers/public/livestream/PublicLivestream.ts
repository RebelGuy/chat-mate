import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicLivestream = PublicObject<{
  /** The internal ID of the livestream. */
  id: number

  /** Link to the YouTube watch page of the livestream. */
  livestreamLink: string

  /** The current status of the livestream. */
  status: 'not_started' | 'live' | 'finished'

  /** The start timestamp of the livestream. Null if status is `not_started`. */
  startTime: number | null

  /** The end timestamp of the livestream. Null if status is not `finished`. */
  endTime: number | null
}>
