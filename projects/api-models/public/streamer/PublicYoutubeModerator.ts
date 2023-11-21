import { PublicObject } from '@rebel/api-models/types'

export type PublicYoutubeModerator = PublicObject<{
  /** YouTube's channel ID of the YouTube channel belonging to the moderator. */
  externalChannelId: string

  /** The internal ID of the YouTube channel belonging to the moderator. This will be null if the moderator is not yet known to ChatMate. */
  channelId: number | null
}>
