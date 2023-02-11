import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicLivestream } from '@rebel/server/controllers/public/livestream/PublicLivestream'

export type PublicLivestreamStatus = PublicObject<{
  livestream: PublicObject<PublicLivestream>

  /** The current number of viewers watching the Youtube livestream. Null if status is not `live`. */
  youtubeLiveViewers: number | null

  /** The current number of viewers watching the Twitch livestream. Null if status is not `live`. */
  twitchLiveViewers: number | null
}>
