import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicChannel = PublicObject<{
  /** The internal YoutubeChannel or TwitchChannel id. */
  channelId: number

  /** The default user attached to the channel. */
  defaultUserId: number

  /** The platform that the channel belongs to. */
  platform: 'youtube' | 'twitch'

  /** The current display name of the channel. */
  displayName: string
}>
