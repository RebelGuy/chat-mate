import { PublicRankedUser } from '@rebel/api-models/public/user/PublicRankedUser'
import { PublicUser } from '@rebel/api-models/public/user/PublicUser'
import { ApiResponse, PublicObject, ApiRequest } from '@rebel/api-models/types'

export type GetLeaderboardResponse = ApiResponse<{
  rankedUsers: PublicObject<PublicRankedUser>[]
}>

export type GetRankResponse = ApiResponse<{
  relevantIndex: number
  rankedUsers: PublicObject<PublicRankedUser>[]
}>

export type ModifyExperienceRequest = ApiRequest<{
  userId: number,
  deltaLevels: number,
  message: string | null
}>

export type ModifyExperienceResponse = ApiResponse<{
  updatedUser: PublicObject<PublicUser>
}>
