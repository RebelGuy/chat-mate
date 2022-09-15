import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicLivestream } from '@rebel/server/controllers/public/livestream/PublicLivestream'

export type PublicLivestreamStatus = PublicObject<3, {
  schema: 3

  livestream: Tagged<1, PublicLivestream>

  /** The current number of viewers watching the Youtube livestream. Null if status is not `live`. */
  youtubeLiveViewers: number | null

  /** The current number of viewers watching the Twitch livestream. Null if status is not `live`. */
  twitchLiveViewers: number | null
}>
