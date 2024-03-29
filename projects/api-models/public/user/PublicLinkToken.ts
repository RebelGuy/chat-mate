import { PublicObject } from '@rebel/api-models/types'

export type PublicLinkToken = PublicObject<{
  /** The link token. */
  token: string

  /** The current status of the link token. */
  status: 'waiting' | 'pending' | 'processing' | 'succeeded' | 'failed'

  /** Which platform the channel is on. */
  platform: 'youtube' | 'twitch'

  /** The current display name of the channel. */
  channelUserName: string

  /** A message containing more infor about a `succeeded` or `failed` link token. */
  message: string | null

  /** The timestamp at which this token was used. Only set if the status is `succeeded` or `failed`. */
  dateCompleted: number | null
}>
