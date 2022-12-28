import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicLinkToken = PublicObject<1, {
  schema: 1

  /** The link token. */
  token: string

  /** The current status of the link token. */
  status: 'waiting' | 'processing' | 'succeeded' | 'failed'

  /** Which platform the channel is on. */
  platform: 'youtube' | 'twitch'

  /** The current display name of the channel. */
  channelUserName: string
}>
