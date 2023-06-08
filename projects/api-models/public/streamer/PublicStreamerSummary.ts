import { PublicObject } from '@rebel/api-models/types'
import { PublicLivestream } from '@rebel/api-models/public/livestream/PublicLivestream'
import { PublicChannel } from '@rebel/api-models/public/user/PublicChannel'

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
