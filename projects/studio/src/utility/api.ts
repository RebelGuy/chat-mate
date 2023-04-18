import { AddCustomEmojiRequest, AddCustomEmojiResponse, GetCustomEmojisResponse, UpdateCustomEmojiRequest, UpdateCustomEmojiResponse } from '@rebel/server/controllers/EmojiController'
import { GetMasterchatAuthenticationResponse, GetStatusResponse, PingResponse, SetActiveLivestreamRequest, SetActiveLivestreamResponse } from '@rebel/server/controllers/ChatMateController'
import { GetAccessibleRanksResponse, GetUserRanksResponse } from '@rebel/server/controllers/RankController'
import { ApproveApplicationRequest, ApproveApplicationResponse, CreateApplicationRequest, CreateApplicationResponse, GetApplicationsResponse, GetPrimaryChannelsResponse, GetStreamersResponse, GetTwitchStatusResponse, RejectApplicationRequest, RejectApplicationResponse, SetPrimaryChannelResponse, UnsetPrimaryChannelResponse, WithdrawApplicationRequest, WithdrawApplicationResponse } from '@rebel/server/controllers/StreamerController'
import { SERVER_URL } from '@rebel/studio/utility/global'
import { AuthenticateResponse, LoginRequest, LoginResponse, LogoutResponse, RegisterRequest, RegisterResponse } from '@rebel/server/controllers/AccountController'
import { GetStreamlabsStatusResponse, SetWebsocketTokenRequest, SetWebsocketTokenResponse } from '@rebel/server/controllers/DonationController'
import { GetLinkHistoryResponse, CreateLinkTokenResponse, GetLinkedChannelsResponse, RemoveLinkedChannelResponse, SearchUserResponse, SearchUserRequest, AddLinkedChannelResponse, GetUserResponse } from '@rebel/server/controllers/UserController'
import { GetTwitchLoginUrlResponse, TwitchAuthorisationResponse, GetAdministrativeModeResponse } from '@rebel/server/controllers/AdminController'
import { GenericObject } from '@rebel/shared/types'
import { ApiResponse, PublicObject } from '@rebel/server/controllers/ControllerBase'
import { Method, Request } from '@rebel/studio/hooks/useRequest'

const LOGIN_TOKEN_HEADER = 'X-Login-Token'
const STREAMER_HEADER = 'X-Streamer'

const baseUrl = SERVER_URL + '/api'

function requestBuilder<TResponse extends ApiResponse<any>, TRequestData extends PublicObject<TRequestData extends false ? never : TRequestData> | false = false, TArgs extends any[] = []> (method: TRequestData extends false ? Method : Exclude<Method, 'GET'>, path: string,                                requiresStreamer?: boolean | 'self', requiresLogin?: boolean): TRequestData extends false ? () => Request<TResponse, TRequestData> : (data: TRequestData) => Request<TResponse, TRequestData>
function requestBuilder<TResponse extends ApiResponse<any>, TRequestData extends PublicObject<TRequestData extends false ? never : TRequestData> | false = false, TArgs extends any[] = []> (method: TRequestData extends false ? Method : Exclude<Method, 'GET'>, path: (...args: TArgs) => string,            requiresStreamer?: boolean | 'self', requiresLogin?: boolean): (...args: TRequestData extends false ? TArgs : [TRequestData, ...TArgs]) => Request<TResponse, TRequestData>
function requestBuilder<TResponse extends ApiResponse<any>, TRequestData extends PublicObject<TRequestData extends false ? never : TRequestData> | false, TArgs extends any[]>              (method: TRequestData extends false ? Method : Exclude<Method, 'GET'>, path: string | ((...args: TArgs) => string), requiresStreamer?: boolean | 'self', requiresLogin?: boolean): (...args: TRequestData extends false ? TArgs : [TRequestData, ...TArgs]) => Request<TResponse, TRequestData> {
  if (method === 'GET') {
    // GET method implies that `TRequestData extends false` (and hence `data extends never`), but the compiler doesn't understand that
    return (...args: any) => ({
      method: method,
      path: typeof path === 'string' ? path : path(...args),
      requiresLogin,
      requiresStreamer
    }) as any
  } else {
    return (...args: TRequestData extends false ? TArgs : [TRequestData, ...TArgs]) => ({
      method: method,
      path: typeof path === 'string' ? path : path(...((typeof args[0] === 'object' ? args.slice(1) : args) as TArgs)), // yuck
      data: typeof args[0] === 'object' ? args[0] : null,
      requiresLogin,
      requiresStreamer
    })
  }
}

export const getAllCustomEmojis = requestBuilder<GetCustomEmojisResponse>('GET', `/emoji/custom`)

export const updateCustomEmoji = requestBuilder<UpdateCustomEmojiResponse, UpdateCustomEmojiRequest> ('PATCH', `/emoji/custom`, 'self')

export const addCustomEmoji = requestBuilder<AddCustomEmojiResponse, AddCustomEmojiRequest> ('POST', `/emoji/custom`, 'self')

export const setActiveLivestream = requestBuilder<SetActiveLivestreamResponse, SetActiveLivestreamRequest>('PATCH', `/chatMate/livestream`, 'self')

export const ping = requestBuilder<PingResponse>('GET', `/chatMate/ping`, false, false)

export const getMasterchatAuthentication = requestBuilder<GetMasterchatAuthenticationResponse>('GET', `/chatMate/masterchat/authentication`, false)

export const getStatus = requestBuilder<GetStatusResponse>('GET', `/chatMate/status`, 'self')

export const getAccessibleRanks = requestBuilder<GetAccessibleRanksResponse>('GET', `/rank/accessible`)

export const getRanksForStreamer = requestBuilder<GetUserRanksResponse>('GET', `/rank`)

export const getGlobalRanks = requestBuilder<GetUserRanksResponse>('GET', `/rank`, false)

export const registerAccount = requestBuilder<RegisterResponse, RegisterRequest>('POST', `/account/register`, false, false)

export const login = requestBuilder<LoginResponse, LoginRequest>('POST', `/account/login`, false, false)

export const logout = requestBuilder<LogoutResponse>('POST', `/account/logout`, false)

export async function authenticate (loginToken: string): Promise<AuthenticateResponse> {
  return await POST('/account/authenticate', {}, loginToken)
}

export const getStreamers = requestBuilder<GetStreamersResponse>('GET', `/streamer`, false)

export const getStreamerApplications = requestBuilder<GetApplicationsResponse>('GET', `/streamer/application`, false)

export const createStreamerApplication = requestBuilder<CreateApplicationResponse, CreateApplicationRequest>('POST', `/streamer/application`, false)

export const approveStreamerApplication = requestBuilder<ApproveApplicationResponse, ApproveApplicationRequest, [number]>('POST', (applicationId: number) => `/streamer/application/${applicationId}/approve`, false)

export const rejectStreamerApplication = requestBuilder<RejectApplicationResponse, RejectApplicationRequest, [number]>('POST', (applicationId: number) => `/streamer/application/${applicationId}/reject`, false)

export const withdrawStreamerApplication = requestBuilder<WithdrawApplicationResponse, WithdrawApplicationRequest, [number]>('POST', (applicationId: number) => `/streamer/application/${applicationId}/withdraw`, false)

export const getPrimaryChannels = requestBuilder<GetPrimaryChannelsResponse>('GET', `/streamer/primaryChannels`, false)

export const setPrimaryChannel = requestBuilder<SetPrimaryChannelResponse, false, [platform: 'youtube' | 'twitch', channelId: number]>(
  'POST',
  (platform, channelId) => `/streamer/primaryChannels/${platform}/${channelId}`,
  false
)

export const unsetPrimaryChannel = requestBuilder<UnsetPrimaryChannelResponse, false, [platform: 'youtube' | 'twitch']>(
  'DELETE',
  (platform) => `/streamer/primaryChannels/${platform}`,
  false
)

export const getTwitchEventStatuses = requestBuilder<GetTwitchStatusResponse>('GET', `/streamer/twitch/status`, 'self')

export const setStreamlabsSocketToken = requestBuilder<SetWebsocketTokenResponse, SetWebsocketTokenRequest>('POST', `/donation/streamlabs/socketToken`, 'self')

export const getStreamlabsStatus = requestBuilder<GetStreamlabsStatusResponse>('GET', `/donation/streamlabs/status`, 'self')

export const getUser = requestBuilder<GetUserResponse>('GET', `/user`)

export const searchUser = requestBuilder<SearchUserResponse, SearchUserRequest>('POST', `/user/search`)

export const searchRegisteredUser = requestBuilder<SearchUserResponse, SearchUserRequest>('POST', `/user/search/registered`)

export const getLinkedChannels = requestBuilder<GetLinkedChannelsResponse, false, [admin_aggregateUserId?: number]>(
  'GET',
  (admin_aggregateUserId) => constructPath('/user/link/channels', { admin_aggregateUserId }),
  false
)

export const addLinkedChannel = requestBuilder<AddLinkedChannelResponse, false, [aggregateUserId: number, defaultUserId: number]>(
  'POST',
  (aggregateUserId, defaultUserId) => `/user/link/channels/${aggregateUserId}/${defaultUserId}`,
  false
)

export const removeLinkedChannel = requestBuilder<RemoveLinkedChannelResponse, false, [defaultUserId: number, transferRanks: boolean, relinkChatExperience: boolean, relinkDonations: boolean]>(
  'DELETE',
  (defaultUserId, transferRanks, relinkChatExperience, relinkDonations) => constructPath(`/user/link/channels/${defaultUserId}`, { transferRanks, relinkChatExperience, relinkDonations }),
  false
)

export const getLinkHistory = requestBuilder<GetLinkHistoryResponse, false, [admin_aggregateUserId?: number]>(
  'GET',
  (admin_aggregateUserId?: number) => constructPath(`/user/link/history`, { admin_aggregateUserId }),
  false
)

export const createLinkToken = requestBuilder<CreateLinkTokenResponse, false, [string]>(
  'POST',
  (externalId) => constructPath(`/user/link/token`, { externalId }),
  false
)

export const getAdministrativeMode = requestBuilder<GetAdministrativeModeResponse>('GET', '/admin/administrativeMode', false)

export const getTwitchLoginUrl = requestBuilder<GetTwitchLoginUrlResponse>('GET', '/admin/twitch/login', false)

export const authoriseTwitch = requestBuilder<TwitchAuthorisationResponse, false, [code: string]>(
  'POST',
  (code) => constructPath('/admin/twitch/authorise', { code }),
  false
)

async function GET (path: string, loginToken?: string, streamer?: string): Promise<any> {
  return await request('GET', path, null, loginToken, streamer)
}

async function POST (path: string, requestData: GenericObject | null, loginToken?: string, streamer?: string): Promise<any> {
  return await request('POST', path, requestData, loginToken, streamer)
}

async function PATCH (path: string, requestData: GenericObject | null, loginToken?: string, streamer?: string): Promise<any> {
  return await request('PATCH', path, requestData, loginToken, streamer)
}

async function DELETE (path: string, requestData: GenericObject | null, loginToken?: string, streamer?: string): Promise<any> {
  return await request('DELETE', path, requestData, loginToken, streamer)
}

async function request (method: string, path: string, requestData: GenericObject | null, loginToken: string | undefined, streamer: string | undefined) {
  let headers: HeadersInit = {
    'Content-Type': 'application/json'
  }
  if (loginToken != null) {
    headers[LOGIN_TOKEN_HEADER] = loginToken
  }
  if (streamer != null) {
    headers[STREAMER_HEADER] = streamer
  }

  const response = await fetch(baseUrl + path, {
    method: method,
    body: requestData == null ? undefined : JSON.stringify(requestData),
    headers: headers
  })
  const body = await response.text()
  return JSON.parse(body)
}

function constructPath (path: string, queryParams?: Record<string, string | number | boolean | undefined>) {
  let definedParams: [string, string | number | boolean][] = []
  for (const key in queryParams) {
    if (['string', 'number', 'boolean'].includes(typeof queryParams[key])) {
      definedParams.push([key, queryParams[key]!])
    }
  }

  definedParams.forEach((pair, i) => path += `${i === 0 ? '?' : '&'}${pair[0]}=${pair[1]}` )
  return path
}