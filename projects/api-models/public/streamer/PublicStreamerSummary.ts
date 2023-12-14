import { PublicObject } from '@rebel/api-models/types'
import { PublicLivestream } from '@rebel/api-models/public/livestream/PublicLivestream'
import { PublicChannel } from '@rebel/api-models/public/user/PublicChannel'

export type PublicStreamerSummary = PublicObject<{
  /** The streamer's registered username on ChatMate. */
  username: string

  /** The Youtube livestream that is currently in progress, if any. */
  currentYoutubeLivestream: PublicLivestream | null

  /** The Twitch livestream that is currently in progress, if any. */
  currentTwitchLivestream: PublicLivestream | null

  /** The primary YouTube channel of the streamer, if set. */
  youtubeChannel: PublicChannel | null

  /** The primary Twitch channel of the streamer, if set. */
  twitchChannel: PublicChannel | null
}>
