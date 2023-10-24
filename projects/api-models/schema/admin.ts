import { PublicLinkAttemptLog } from '@rebel/api-models/public/user/PublicLinkAttemptLog'
import { ApiResponse } from '@rebel/api-models/types'
import { EmptyObject } from '@rebel/shared/types'

export type GetAdministrativeModeResponse = ApiResponse<{ isAdministrativeMode: boolean }>

export type GetTwitchLoginUrlResponse = ApiResponse<{ url: string, twitchUsername: string }>

export type TwitchAuthorisationResponse = ApiResponse<EmptyObject>

export type ReconnectTwitchChatClientResponse = ApiResponse<EmptyObject>

export type ResetTwitchSubscriptionsResponse = ApiResponse<EmptyObject>

export type GetYoutubeLoginUrlResponse = ApiResponse<{ url: string, youtubeChannelName: string }>

export type YoutubeAuthorisationResponse = ApiResponse<EmptyObject>

export type GetLinkAttemptLogsResponse = ApiResponse<{ logs: PublicLinkAttemptLog[] }>

export type ReleaseLinkAttemptResponse = ApiResponse<EmptyObject>
