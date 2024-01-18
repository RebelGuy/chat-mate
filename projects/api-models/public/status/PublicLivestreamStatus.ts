import { PublicObject } from '@rebel/api-models/types'
import { PublicLivestream } from '@rebel/api-models/public/livestream/PublicLivestream'

export type PublicLivestreamStatus = PublicObject<{
  /** The current Youtube livestream. Null if no active stream is set. */
  youtubeLivestream: PublicObject<PublicLivestream> | null

  /** The current number of viewers watching the Youtube livestream. Null if status is not `live`. */
  youtubeLiveViewers: number | null

  /** The ongoing Twitch livestream. Null if status is not `live`. */
  twitchLivestream: PublicObject<PublicLivestream> | null

  /** The current number of viewers watching the Twitch livestream. Null if status is not `live`. */
  twitchLiveViewers: number | null
}>
