import { PublicDonation } from '@rebel/api-models/public/donation/PublicDonation'
import { ApiResponse, PublicObject, ApiRequest } from '@rebel/api-models/types'

export type GetDonationsResponse = ApiResponse<{ donations: PublicObject<PublicDonation>[] }>

export type LinkUserResponse = ApiResponse<{ updatedDonation: PublicObject<PublicDonation> }>

export type UnlinkUserResponse = ApiResponse<{ updatedDonation: PublicObject<PublicDonation> }>

export type SetWebsocketTokenRequest = ApiRequest<{ websocketToken: string | null }>
export type SetWebsocketTokenResponse = ApiResponse<{ result: 'success' | 'noChange' }>

export type GetStreamlabsStatusResponse = ApiResponse<{ status: 'notListening' | 'listening' | 'error' }>
