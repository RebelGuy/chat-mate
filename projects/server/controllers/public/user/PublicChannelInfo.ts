import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicChannelInfo = PublicObject<1, {
  schema: 1

  /** The internal default user ID attached to the channel. */
  defaultUserId: number

  /** The YouTube channel ID or Twitch user name of the channel. */
  externalIdOrUserName: string

  /** The platform to which the channel belongs. */
  platform: 'youtube' | 'twitch'

  /** The name of the user's active YouTube or Twitch channel. */
  channelName: string
}>
