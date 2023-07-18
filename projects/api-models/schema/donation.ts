import { PublicCurrency } from '@rebel/api-models/public/donation/PublicCurrency'
import { PublicDonation } from '@rebel/api-models/public/donation/PublicDonation'
import { ApiResponse, ApiRequest } from '@rebel/api-models/types'
import { EmptyObject } from '@rebel/shared/types'

export type GetDonationsResponse = ApiResponse<{ donations: PublicDonation[] }>

export type DeleteDonationResponse = ApiResponse<EmptyObject>

export type CreateDonationRequest = ApiRequest<{ amount: number, currencyCode: string, name: string, message: string | null }>
export type CreateDonationResponse = ApiResponse<{ newDonation: PublicDonation }>

export type GetCurrenciesResponse = ApiResponse<{ currencies: PublicCurrency[] }>

export type LinkUserResponse = ApiResponse<{ updatedDonation: PublicDonation }>

export type UnlinkUserResponse = ApiResponse<{ updatedDonation: PublicDonation }>

export type RefundDonationResponse = ApiResponse<{ updatedDonation: PublicDonation }>

export type SetWebsocketTokenRequest = ApiRequest<{ websocketToken: string | null }>
export type SetWebsocketTokenResponse = ApiResponse<{ result: 'success' | 'noChange' }>

export type GetStreamlabsStatusResponse = ApiResponse<{ status: 'notListening' | 'listening' | 'error' }>
