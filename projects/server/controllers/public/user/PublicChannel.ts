import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicChannel = PublicObject<{
  /** The internal YoutubeChannel or TwitchChannel id. */
  channelId: number

  /** The internal default user ID attached to the channel. */
  defaultUserId: number

  /** The YouTube channel ID or Twitch user name of the channel. */
  externalIdOrUserName: string

  /** The platform that the channel belongs to. */
  platform: 'youtube' | 'twitch'

  /** The current display name of the channel. */
  displayName: string

  /** The link to the external channel page. */
  channelUrl: string
}>
