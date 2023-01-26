import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicLinkHistoryItem = PublicObject<1, {
  schema: 1

  /** The type of the link item. */
  type: 'link' | 'unlink'

  /** The link token. Only set if the link attempt was carried out as part of a command. */
  token: string | null

  /** The current status of the link token or link attempt. */
  status: 'waiting' | 'pending' | 'processing' | 'succeeded' | 'failed'

  /** Which platform the channel is on. */
  platform: 'youtube' | 'twitch'

  /** The current display name of the channel. */
  channelUserName: string

  /** A message containing more information about a `succeeded` or `failed` attempt. */
  message: string | null

  /** The timestamp at which this attempt occurred used. Only set if the status is `succeeded` or `failed`. */
  dateCompleted: number | null
}>
