import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicLivestreamStatus = PublicObject<1, {
  schema: 1

  /** Link to the YouTube watch page of the livestream. */
  livestreamLink: string

  /** The current status of the livestream. */
  status: 'not_started' | 'live' | 'finished'

  /** The start timestamp of the livestream. Null if status is `not_started`. */
  startTime: number | null

  /** The end timestamp of the livestream. Null if status is not `finished`. */
  endTime: number | null

  /** The current number of viewers watching the livestream, as reported by YouTUbe. Null if status is not `live`. */
  liveViewers: number | null
}>
