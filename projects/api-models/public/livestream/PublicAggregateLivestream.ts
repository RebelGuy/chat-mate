import { PublicLivestream } from '@rebel/api-models/public/livestream/PublicLivestream'
import { PublicObject } from '@rebel/api-models/types'

export type PublicAggregateLivestream = PublicObject<{
  /** The start time of the aggregate livestream, corresponding to the start time of the first livestream in the `livestreams` array. */
  startTime: number

  /** The end time of the aggregate livestream. Null if the livestream is still ongoing (this means at one Youtube and/or
   * one Twitch livestream in the `livestreams` array must also have an `endTime` of null. */
  endTime: number | null

  /** The livestreams, ordered in ascending order by start time, that make up this aggregate livestream.
   * Contains at least one item. Does not include Youtube streams that haven't started yet. */
  livestreams: PublicLivestream[]
}>
