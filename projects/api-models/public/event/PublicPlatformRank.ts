import { PublicObject } from '@rebel/api-models/types'

export type PublicPlatformRank = PublicObject<{
  /** The platform for which an external rank update was made. */
  platform: 'youtube' | 'twitch'

  /** The name of the channel on the external platform. */
  channelName: string

  /** Whether the rank update on the external platform was successful or not. */
  success: boolean
}>
