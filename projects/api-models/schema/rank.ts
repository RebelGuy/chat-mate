import { PublicChannelRankChange } from '@rebel/api-models/public/rank/PublicChannelRankChange'
import { PublicRank } from '@rebel/api-models/public/rank/PublicRank'
import { PublicUserRank } from '@rebel/api-models/public/rank/PublicUserRank'
import { ApiResponse, ApiRequest, PublicObject } from '@rebel/api-models/types'

export type GetUserRanksResponse = ApiResponse<{ ranks: PublicUserRank[] }>

export type GetAccessibleRanksResponse = ApiResponse<{ accessibleRanks: PublicRank[] }>

export type AddUserRankRequest = ApiRequest<{
  userId: number,
  message: string | null,
  durationSeconds: number | null,
  rank: 'famous' | 'donator' | 'supporter' | 'member'
}>
export type AddUserRankResponse = ApiResponse<{
  newRank: PublicObject<PublicUserRank>
}>

export type RemoveUserRankRequest = ApiRequest<{
  removedByRegisteredUserId: number
  userId: number,
  message: string | null,
  rank: 'famous' | 'donator' | 'supporter' | 'member'
}>
export type RemoveUserRankResponse = ApiResponse<{
  removedRank: PublicObject<PublicUserRank>
}>

export type AddModRankRequest = ApiRequest<{
  userId: number,
  message: string | null
}>
export type AddModRankResponse = ApiResponse<{
  newRank: PublicObject<PublicUserRank> | null
  newRankError: string | null
  channelModChanges: PublicObject<PublicChannelRankChange>[]
}>

export type RemoveModRankRequest = ApiRequest<{
  userId: number,
  message: string | null
}>
export type RemoveModRankResponse = ApiResponse<{
  removedRank: PublicObject<PublicUserRank> | null
  removedRankError: string | null
  channelModChanges: PublicObject<PublicChannelRankChange>[]
}>
