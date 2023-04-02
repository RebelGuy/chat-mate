import { AddCustomEmojiRequest, AddCustomEmojiResponse, GetCustomEmojisResponse, UpdateCustomEmojiRequest, UpdateCustomEmojiResponse } from '@rebel/server/controllers/EmojiController'
import { GetMasterchatAuthenticationResponse, GetStatusResponse, PingResponse, SetActiveLivestreamRequest, SetActiveLivestreamResponse } from '@rebel/server/controllers/ChatMateController'
import { GetAccessibleRanksResponse, GetUserRanksResponse } from '@rebel/server/controllers/RankController'
import { ApproveApplicationRequest, ApproveApplicationResponse, CreateApplicationRequest, CreateApplicationResponse, GetApplicationsResponse, GetPrimaryChannelsResponse, GetStreamersResponse, RejectApplicationRequest, RejectApplicationResponse, SetPrimaryChannelResponse, UnsetPrimaryChannelResponse, WithdrawApplicationRequest, WithdrawApplicationResponse } from '@rebel/server/controllers/StreamerController'
import { PublicCustomEmojiNew } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { SERVER_URL } from '@rebel/studio/utility/global'
import { AuthenticateResponse, LoginRequest, LoginResponse, LogoutResponse, RegisterRequest, RegisterResponse } from '@rebel/server/controllers/AccountController'
import { GetStreamlabsStatusResponse, SetWebsocketTokenRequest, SetWebsocketTokenResponse } from '@rebel/server/controllers/DonationController'
import { GetLinkHistoryResponse, CreateLinkTokenResponse, GetLinkedChannelsResponse, RemoveLinkedChannelResponse, SearchUserResponse, SearchUserRequest, AddLinkedChannelResponse } from '@rebel/server/controllers/UserController'
import { GenericObject, Primitive } from '@rebel/shared/types'
import { PathParam } from '@rebel/studio/utility/types'
import { ApiResponse, PublicObject } from '@rebel/server/controllers/ControllerBase'
import { Method, Request } from '@rebel/studio/hooks/useRequest'

const LOGIN_TOKEN_HEADER = 'X-Login-Token'
const STREAMER_HEADER = 'X-Streamer'

const baseUrl = SERVER_URL + '/api'

function requestBuilder<TResponse extends ApiResponse<any>, TRequestData extends PublicObject<TRequestData extends false ? never : TRequestData> | false = false, TArgs extends any[] = []> (method: TRequestData extends false ? Method : Exclude<Method, 'GET'>, path: string,                                requiresStreamer?: boolean, requiresLogin?: boolean): TRequestData extends false ? () => Request<TResponse, TRequestData> : (data: TRequestData) => Request<TResponse, TRequestData>
function requestBuilder<TResponse extends ApiResponse<any>, TRequestData extends PublicObject<TRequestData extends false ? never : TRequestData> | false = false, TArgs extends any[] = []> (method: TRequestData extends false ? Method : Exclude<Method, 'GET'>, path: (...args: TArgs) => string,            requiresStreamer?: boolean, requiresLogin?: boolean): (...args: TRequestData extends false ? TArgs : [TRequestData, ...TArgs]) => Request<TResponse, TRequestData>
function requestBuilder<TResponse extends ApiResponse<any>, TRequestData extends PublicObject<TRequestData extends false ? never : TRequestData> | false, TArgs extends any[]>              (method: TRequestData extends false ? Method : Exclude<Method, 'GET'>, path: string | ((...args: TArgs) => string), requiresStreamer?: boolean, requiresLogin?: boolean): (...args: TRequestData extends false ? TArgs : [TRequestData, ...TArgs]) => Request<TResponse, TRequestData> {
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

export const updateCustomEmoji = requestBuilder<UpdateCustomEmojiResponse, UpdateCustomEmojiRequest> ('PATCH', `/emoji/custom`)

export const addCustomEmoji = requestBuilder<AddCustomEmojiResponse, AddCustomEmojiRequest> ('POST', `/emoji/custom`)

export const setActiveLivestream = requestBuilder<SetActiveLivestreamResponse, SetActiveLivestreamRequest>('PATCH', `/chatMate/livestream`)

export const ping = requestBuilder<PingResponse>('GET', `/chatMate/ping`, false, false)

export const getMasterchatAuthentication = requestBuilder<GetMasterchatAuthenticationResponse>('GET', `/chatMate/masterchat/authentication`, false)

export const getStatus = requestBuilder<GetStatusResponse>('GET', `/chatMate/status`)

export const getAccessibleRanks =requestBuilder<GetAccessibleRanksResponse>('GET', `/rank/accessible`)

/** Gets global ranks if the streamer is not provided. */
export async function getRanks (loginToken: string, streamer?: string): Promise<GetUserRanksResponse> {
  return await GET('/rank', loginToken, streamer)
}

export const registerAccount = requestBuilder<RegisterResponse, RegisterRequest>('POST', `/account/register`, false, false)

export const login = requestBuilder<LoginResponse, LoginRequest>('POST', `/account/login`, false, false)

export const logout = requestBuilder<LogoutResponse>('POST', `/account/logout`, false)

export async function authenticate (loginToken: string): Promise<AuthenticateResponse> {
  return await POST('/account/authenticate', {}, loginToken)
}

export async function getStreamers (loginToken: string): Promise<GetStreamersResponse> {
  return await GET('/streamer', loginToken)
}

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

export const setStreamlabsSocketToken = requestBuilder<SetWebsocketTokenResponse, SetWebsocketTokenRequest>('POST', `/donation/streamlabs/socketToken`)

export const getStreamlabsStatus = requestBuilder<GetStreamlabsStatusResponse>('GET', `/donation/streamlabs/status`)

export async function searchUser (loginToken: string, streamer: string, searchTerm: string): Promise<SearchUserResponse> {
  const request: SearchUserRequest = { searchTerm }
  return await POST(`/user/search`, request, loginToken, streamer)
}

export async function searchRegisteredUser (loginToken: string, streamer: string, searchTerm: string): Promise<SearchUserResponse> {
  const request: SearchUserRequest = { searchTerm }
  return await POST(`/user/search/registered`, request, loginToken, streamer)
}

export const getLinkedChannels = requestBuilder<GetLinkedChannelsResponse, false, [admin_aggregateUserId?: number]>(
  'GET',
  (admin_aggregateUserId) => constructPath('/user/link/channels', { admin_aggregateUserId })
)

export const addLinkedChannel = requestBuilder<AddLinkedChannelResponse, false, [aggregateUserId: number, defaultUserId: number]>(
  'POST',
  (aggregateUserId, defaultUserId) => `/user/link/channels/${aggregateUserId}/${defaultUserId}`,
  false
)

export async function removeLinkedChannel (loginToken: string, defaultUserId: number, transferRanks: boolean, relinkChatExperience: boolean, relinkDonations: boolean): Promise<RemoveLinkedChannelResponse> {
  const queryParams = { transferRanks: transferRanks, relinkChatExperience: relinkChatExperience, relinkDonations: relinkDonations }
  return await DELETE(constructPath(`/user/link/channels/${defaultUserId}`, queryParams), null, loginToken)
}

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
