import { PublicChannelRankChange } from '@rebel/api-models/public/rank/PublicChannelRankChange'
import { PublicUserRank } from '@rebel/api-models/public/rank/PublicUserRank'
import { ApiResponse, PublicObject, ApiRequest } from '@rebel/api-models/types'

export type GetSinglePunishment = ApiResponse<{ punishment: PublicObject<PublicUserRank> }>

export type GetUserPunishments = ApiResponse<{ punishments: PublicObject<PublicUserRank>[] }>

export type BanUserRequest = ApiRequest<{ userId: number, message: string | null }>
export type BanUserResponse = ApiResponse<{
  newPunishment: PublicObject<PublicUserRank> | null
  newPunishmentError: string | null
  channelPunishments: PublicObject<PublicChannelRankChange>[]
}>

export type UnbanUserRequest = ApiRequest<{ userId: number, message: string | null }>
export type UnbanUserResponse = ApiResponse<{
  removedPunishment: PublicObject<PublicUserRank> | null
  removedPunishmentError: string | null
  channelPunishments: PublicObject<PublicChannelRankChange>[]
}>

export type TimeoutUserRequest = ApiRequest<{ userId: number, message: string | null, durationSeconds: number }>
export type TimeoutUserResponse = ApiResponse<{
  newPunishment: PublicObject<PublicUserRank> | null
  newPunishmentError: string | null
  channelPunishments: PublicObject<PublicChannelRankChange>[]
}>

export type RevokeTimeoutRequest = ApiRequest<{ userId: number, message: string | null }>
export type RevokeTimeoutResponse = ApiResponse<{
  removedPunishment: PublicObject<PublicUserRank> | null
  removedPunishmentError: string | null
  channelPunishments: PublicObject<PublicChannelRankChange>[]
}>

export type MuteUserRequest = ApiRequest<{ userId: number, message: string | null, durationSeconds: number | null }>
export type MuteUserResponse = ApiResponse<{ newPunishment: PublicObject<PublicUserRank> }>

export type UnmuteUserRequest = ApiRequest<{ userId: number, message: string | null }>
export type UnmuteUserResponse = ApiResponse<{ removedPunishment: PublicObject<PublicUserRank> }>
