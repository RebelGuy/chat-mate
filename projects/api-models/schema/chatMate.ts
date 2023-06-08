import { ApiResponse } from '@rebel/api-models/types'
import { EmptyObject } from '@rebel/shared/types'

export type PingResponse = ApiResponse<EmptyObject>

export type ChatMateStatsResponse = ApiResponse<{
  streamerCount: number
  registeredUserCount: number
  uniqueChannelCount: number
  chatMessageCount: number
  totalExperience: number
  totalDaysLivestreamed: number
}>

export type GetMasterchatAuthenticationResponse = ApiResponse<{ authenticated: boolean | null }>

export type GetChatMateRegisteredUsernameResponse = ApiResponse<{ username: string }>
