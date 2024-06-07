import { ApiResponse } from '@rebel/api-models/types'
import { EmptyObject } from '@rebel/shared/types'

export type PingResponse = ApiResponse<EmptyObject>

export type ChatMateStatsResponse = ApiResponse<{
  streamerCount: number
  youtubeStreamerCount: number
  twitchStreamerCount: number

  registeredUserCount: number

  uniqueChannelCount: number
  uniqueYoutubeChannelCount: number
  uniqueTwitchChannelCount: number

  chatMessageCount: number
  youtubeMessageCount: number
  twitchMessageCount: number

  totalExperience: number

  totalDaysLivestreamed: number
  youtubeTotalDaysLivestreamed: number
  twitchTotalDaysLivestreamed: number
}>

export type GetMasterchatAuthenticationResponse = ApiResponse<{
  authenticated: boolean | null
  lastUpdatedTimestamp: number | null
}>

export type GetChatMateRegisteredUsernameResponse = ApiResponse<{ username: string }>
