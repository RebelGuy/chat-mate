import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicChannel = PublicObject<1, {
  schema: 1

  /** The internal YoutubeChannel or TwitchChannel id. */
  channelId: number

  /** The platform that the channel belongs to. */
  platform: 'youtube' | 'twitch'

  /** The current display name of the channel. */
  displayName: string
}>
