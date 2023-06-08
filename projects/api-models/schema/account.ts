import { ApiRequest, ApiResponse } from '@rebel/api-models/types'
import { EmptyObject } from '@rebel/shared/types'

export type RegisterRequest = ApiRequest<{ username: string, password: string }>
export type RegisterResponse = ApiResponse<{ loginToken: string }>

export type LoginRequest = ApiRequest<{ username: string, password: string }>
export type LoginResponse = ApiResponse<{ loginToken: string, isStreamer: boolean }>

export type LogoutResponse = ApiResponse<EmptyObject>

export type AuthenticateResponse = ApiResponse<{ username: string, isStreamer: boolean }>
