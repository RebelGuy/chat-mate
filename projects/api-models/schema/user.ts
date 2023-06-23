import { PublicChannel } from '@rebel/api-models/public/user/PublicChannel'
import { PublicLinkHistoryItem } from '@rebel/api-models/public/user/PublicLinkHistoryItem'
import { PublicRegisteredUser } from '@rebel/api-models/public/user/PublicRegisteredUser'
import { PublicUser } from '@rebel/api-models/public/user/PublicUser'
import { PublicUserSearchResult } from '@rebel/api-models/public/user/PublicUserSearchResult'
import { ApiResponse, ApiRequest, PublicObject } from '@rebel/api-models/types'
import { EmptyObject } from '@rebel/shared/types'

export type GetUserResponse = ApiResponse<{
  user: PublicUser
}>

export type SearchUserRequest = ApiRequest<{
  searchTerm: string
}>

export type SearchUserResponse = ApiResponse<{
  results: PublicObject<PublicUserSearchResult>[]
}>

export type GetLinkedChannelsResponse = ApiResponse<{
  registeredUser: PublicRegisteredUser
  channels: PublicChannel[]
}>

export type AddLinkedChannelResponse = ApiResponse<EmptyObject>

export type RemoveLinkedChannelResponse = ApiResponse<EmptyObject>

export type GetLinkHistoryResponse = ApiResponse<{
  items: PublicLinkHistoryItem[]
}>

export type CreateLinkTokenResponse = ApiResponse<{
  token: string
}>

export type DeleteLinkTokenResponse = ApiResponse<EmptyObject>
