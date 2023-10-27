import { PublicChatMateEvent } from '@rebel/api-models/public/event/PublicChatMateEvent'
import { PublicApiStatus } from '@rebel/api-models/public/status/PublicApiStatus'
import { PublicLivestreamStatus } from '@rebel/api-models/public/status/PublicLivestreamStatus'
import { PublicStreamerSummary } from '@rebel/api-models/public/streamer/PublicStreamerSummary'
import { PublicTwitchEventStatus } from '@rebel/api-models/public/streamer/PublicTwitchEventStatus'
import { PublicYoutubeModerator } from '@rebel/api-models/public/streamer/PublicYoutubeModerator'
import { PublicStreamerApplication } from '@rebel/api-models/public/user/PublicStreamerApplication'
import { ApiResponse, ApiRequest, PublicObject } from '@rebel/api-models/types'
import { EmptyObject } from '@rebel/shared/types'

export type GetStreamersResponse = ApiResponse<{ streamers: PublicStreamerSummary[] }>

export type CreateApplicationRequest = ApiRequest<{ message: string }>
export type CreateApplicationResponse = ApiResponse<{ newApplication: PublicStreamerApplication }>

export type GetApplicationsResponse = ApiResponse<{ streamerApplications: PublicStreamerApplication[] }>

export type ApproveApplicationRequest = ApiRequest<{ message: string }>
export type ApproveApplicationResponse = ApiResponse<{ updatedApplication: PublicStreamerApplication }>

export type RejectApplicationRequest = ApiRequest<{ message: string }>
export type RejectApplicationResponse = ApiResponse<{ updatedApplication: PublicStreamerApplication }>

export type WithdrawApplicationRequest = ApiRequest<{ message: string }>
export type WithdrawApplicationResponse = ApiResponse<{ updatedApplication: PublicStreamerApplication }>

export type GetPrimaryChannelsResponse = ApiResponse<{ youtubeChannelId: number | null, twitchChannelId: number | null, twitchChannelName: string | null, youtubeChannelName: string | null }>

export type SetPrimaryChannelResponse = ApiResponse<EmptyObject>

export type UnsetPrimaryChannelResponse = ApiResponse<EmptyObject>

export type GetTwitchStatusResponse = ApiResponse<{ statuses: PublicTwitchEventStatus[] }>

export type GetTwitchLoginUrlResponse = ApiResponse<{ url: string }>

export type TwitchAuthorisationResponse = ApiResponse<EmptyObject>

export type GetYoutubeStatusResponse = ApiResponse<{ chatMateIsModerator: boolean, chatMateIsAuthorised: boolean, timestamp: number }>

export type GetYoutubeLoginUrlResponse = ApiResponse<{ url: string }>

export type YoutubeAuthorisationResponse = ApiResponse<EmptyObject>

export type YoutubeRevocationResponse = ApiResponse<EmptyObject>

export type GetYoutubeModeratorsResponse = ApiResponse<{ moderators: PublicYoutubeModerator[] }>

export type GetStatusResponse = ApiResponse<{
  livestreamStatus: PublicObject<PublicLivestreamStatus> | null
  youtubeApiStatus: PublicObject<PublicApiStatus>
  twitchApiStatus: PublicObject<PublicApiStatus>
}>

export type GetEventsResponse = ApiResponse<{
  // include the timestamp so it can easily be used for the next request
  reusableTimestamp: number
  events: PublicObject<PublicChatMateEvent>[]
}>

export type GetEventsRequest = ApiRequest<{ since: number }>

export type SetActiveLivestreamRequest = ApiRequest<{ livestream: string | null }>
export type SetActiveLivestreamResponse = ApiResponse<{ livestreamLink: string | null }>
