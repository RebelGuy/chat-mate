import { PublicObject } from '@rebel/api-models/types'
import { PublicLivestream } from '@rebel/api-models/public/livestream/PublicLivestream'

export type PublicLivestreamStatus = PublicObject<{
  livestream: PublicObject<PublicLivestream>

  /** The current number of viewers watching the Youtube livestream. Null if status is not `live`. */
  youtubeLiveViewers: number | null

  /** The current number of viewers watching the Twitch livestream. Null if status is not `live`. */
  twitchLiveViewers: number | null
}>
