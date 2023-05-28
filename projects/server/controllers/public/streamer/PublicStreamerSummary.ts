import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicLivestream } from '@rebel/server/controllers/public/livestream/PublicLivestream'
import { PublicChannel } from '@rebel/server/controllers/public/user/PublicChannel'

export type PublicStreamerSummary = PublicObject<{
  /** The streamer's registered username on ChatMate. */
  username: string

  /** The livestream that is currently in progress, if any. */
  currentLivestream: PublicLivestream | null

  /** The primary YouTube channel of the streamer, if set. */
  youtubeChannel: PublicChannel | null

  /** The primary Twitch channel of the streamer, if set. */
  twitchChannel: PublicChannel | null
}>
