import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicLinkToken = PublicObject<1, {
  schema: 1

  /** The link token. */
  token: string

  /** The current status of the link token. */
  status: 'waiting' | 'processing' | 'succeeded' | 'failed'

  platform: 'youtube' | 'twitch'

  channelUserName: string
}>
