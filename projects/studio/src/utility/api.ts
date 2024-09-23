import { AddCustomEmojiRequest, AddCustomEmojiResponse, DeleteCustomEmojiResponse, GetCustomEmojisResponse, UpdateCustomEmojiRequest, UpdateCustomEmojiResponse, UpdateCustomEmojiSortOrderRequest, UpdateCustomEmojiSortOrderResponse } from '@rebel/api-models/schema/emoji'
import { ChatMateStatsResponse, GetChatMateRegisteredUsernameResponse, GetMasterchatAuthenticationResponse, PingResponse } from '@rebel/api-models/schema/chatMate'
import { DeleteCustomRankNameResponse, GetAccessibleRanksResponse, GetCustomisableRanksResponse, GetUserRanksResponse, SetCustomRankNameRequest, SetCustomRankNameResponse } from '@rebel/api-models/schema/rank'
import { ApproveApplicationRequest, ApproveApplicationResponse, CreateApplicationRequest, CreateApplicationResponse, GetApplicationsResponse, GetPrimaryChannelsResponse, GetStatusResponse, GetStreamersResponse, GetOfficialChatMateStreamerResponse, GetTwitchStatusResponse, GetYoutubeLoginUrlResponse, GetYoutubeModeratorsResponse, GetYoutubeStatusResponse, RejectApplicationRequest, RejectApplicationResponse, SetActiveLivestreamRequest, SetActiveLivestreamResponse, SetPrimaryChannelResponse, UnsetPrimaryChannelResponse, WithdrawApplicationRequest, WithdrawApplicationResponse, YoutubeAuthorisationResponse, YoutubeRevocationResponse } from '@rebel/api-models/schema/streamer'
import { SERVER_URL } from '@rebel/studio/utility/global'
import { AuthenticateResponse, LoginRequest, LoginResponse, LogoutResponse, RegisterRequest, RegisterResponse, ResetPasswordRequest, ResetPasswordResponse } from '@rebel/api-models/schema/account'
import { GetStreamlabsStatusResponse, SetWebsocketTokenRequest, SetWebsocketTokenResponse } from '@rebel/api-models/schema/donation'
import { GetLinkHistoryResponse, CreateLinkTokenResponse, GetLinkedChannelsResponse, RemoveLinkedChannelResponse, SearchUserResponse, SearchUserRequest, AddLinkedChannelResponse, GetUserResponse, DeleteLinkTokenResponse } from '@rebel/api-models/schema/user'
import { GetTwitchLoginUrlResponse, TwitchAuthorisationResponse, GetAdministrativeModeResponse, ReconnectTwitchChatClientResponse, ResetTwitchSubscriptionsResponse, GetLinkAttemptLogsResponse, ReleaseLinkAttemptResponse, GetYoutubeLoginUrlResponse as GetYoutubeAdminLoginUrlResponse, YoutubeAuthorisationResponse as YoutubeAdminAuthorisationResponse, YoutubeRevocationResponse as YoutubeAdminRevocationResponse } from '@rebel/api-models/schema/admin'
import { GenericObject } from '@rebel/shared/types'
import { ApiResponse } from '@rebel/api-models/types'
import { Method, Request } from '@rebel/studio/hooks/useRequest'
import { PublicObject } from '@rebel/api-models/types'
import { GetLivestreamsResponse } from '@rebel/api-models/schema/livestream'
import { GetChatResponse } from '@rebel/api-models/schema/chat'

const LOGIN_TOKEN_HEADER = 'X-Login-Token'
const STREAMER_HEADER = 'X-Streamer'

const baseUrl = SERVER_URL + '/api'

function requestBuilder<TResponse extends ApiResponse<any>, TRequestData extends PublicObject<any> | false = false, TArgs extends any[] = []> (method: TRequestData extends false ? Method : Exclude<Method, 'GET'>, path: string,                                requiresStreamer?: boolean | 'self', requiresLogin?: boolean): TRequestData extends false ? () => Request<TResponse, TRequestData> : (data: TRequestData) => Request<TResponse, TRequestData>
function requestBuilder<TResponse extends ApiResponse<any>, TRequestData extends PublicObject<any> | false = false, TArgs extends any[] = []> (method: TRequestData extends false ? Method : Exclude<Method, 'GET'>, path: (...args: TArgs) => string,            requiresStreamer?: boolean | 'self', requiresLogin?: boolean): (...args: TRequestData extends false ? TArgs : [TRequestData, ...TArgs]) => Request<TResponse, TRequestData>
function requestBuilder<TResponse extends ApiResponse<any>, TRequestData extends PublicObject<any> | false, TArgs extends any[]>              (method: TRequestData extends false ? Method : Exclude<Method, 'GET'>, path: string | ((...args: TArgs) => string), requiresStreamer?: boolean | 'self', requiresLogin?: boolean): (...args: TRequestData extends false ? TArgs : [TRequestData, ...TArgs]) => Request<TResponse, TRequestData> {
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
      data: typeof args[0] === 'object' ? args[0] : (null as any), // null is used in place of never
      requiresLogin,
      requiresStreamer
    })
  }
}

export const LOGIN_PATH = `/account/login`

export const getChatMateRegisteredUsername = requestBuilder<GetChatMateRegisteredUsernameResponse>('GET', `/chatMate/username`)

export const getAllCustomEmojis = requestBuilder<GetCustomEmojisResponse>('GET', `/emoji/custom`, true, false)

export const updateCustomEmoji = requestBuilder<UpdateCustomEmojiResponse, UpdateCustomEmojiRequest> ('PATCH', `/emoji/custom`, 'self')

export const updateCustomEmojiSortOrder = requestBuilder<UpdateCustomEmojiSortOrderResponse, UpdateCustomEmojiSortOrderRequest> ('PATCH', `/emoji/custom/sortOrder`, 'self')

export const addCustomEmoji = requestBuilder<AddCustomEmojiResponse, AddCustomEmojiRequest> ('POST', `/emoji/custom`, 'self')

export const deleteCustomEmoji = requestBuilder<DeleteCustomEmojiResponse, false, [id: number]> ('DELETE', id => constructPath(`/emoji/custom`, { id }), 'self')

export const ping = requestBuilder<PingResponse>('GET', `/chatMate/ping`, false, false)

export const getChatMateStats = requestBuilder<ChatMateStatsResponse, false, [since?: number]>('GET', since => constructPath(`/chatMate/stats`, { since }), false, false)

export const getMasterchatAuthentication = requestBuilder<GetMasterchatAuthenticationResponse>('GET', `/chatMate/masterchat/authentication`, false)

export const getAccessibleRanks = requestBuilder<GetAccessibleRanksResponse>('GET', `/rank/accessible`, true, false)

export const getRanksForStreamer = requestBuilder<GetUserRanksResponse>('GET', `/rank`)

export const getGlobalRanks = requestBuilder<GetUserRanksResponse>('GET', `/rank`, false)

export const getCustomisableRankNames = requestBuilder<GetCustomisableRanksResponse>('GET', `/rank/customise`, false)

export const setCustomRankName = requestBuilder<SetCustomRankNameResponse, SetCustomRankNameRequest>('POST', `/rank/customise`, true)

export const deleteCustomRankName = requestBuilder<DeleteCustomRankNameResponse, false, [rankName: string]>(
  'DELETE',
  (rankName) => constructPath(`/rank/customise`, { rank: rankName }),
  true
)

export const registerAccount = requestBuilder<RegisterResponse, RegisterRequest>('POST', `/account/register`, false, false)

export const login = requestBuilder<LoginResponse, LoginRequest>('POST', LOGIN_PATH, false, false)

export const logout = requestBuilder<LogoutResponse>('POST', `/account/logout`, false)

export async function authenticate (loginToken: string): Promise<AuthenticateResponse> {
  return await POST('/account/authenticate', {}, loginToken)
}

export const resetPassword = requestBuilder<ResetPasswordResponse, ResetPasswordRequest>('POST', `/account/resetPassword`, false, true)

export const getStreamers = requestBuilder<GetStreamersResponse>('GET', `/streamer`, false, false)

export const getOfficialChatMateStreamer = requestBuilder<GetOfficialChatMateStreamerResponse>('GET', `/streamer/chatMate`, false, false)

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

export const authoriseTwitchStreamer = requestBuilder<TwitchAuthorisationResponse, false, [code: string]>(
  'POST',
  (code) => constructPath('/streamer/twitch/authorise', { code }),
  false
)

export const getYoutubeStreamerLoginUrl = requestBuilder<GetYoutubeLoginUrlResponse>('GET', '/streamer/youtube/login', false)

export const authoriseYoutubeStreamer = requestBuilder<YoutubeAuthorisationResponse, false, [code: string]>(
  'POST',
  (code) => constructPath('/streamer/youtube/authorise', { code }),
  false
)

export const revokeYoutubeStreamer = requestBuilder<YoutubeRevocationResponse>('POST', '/streamer/youtube/revoke', false)

export const getYoutubeModerators = requestBuilder<GetYoutubeModeratorsResponse>('GET', '/streamer/youtube/moderators')

export const getTwitchEventStatuses = requestBuilder<GetTwitchStatusResponse>('GET', `/streamer/twitch/status`, 'self')

export const getTwitchStreamerLoginUrl = requestBuilder<GetTwitchLoginUrlResponse>('GET', '/streamer/twitch/login', false)

export const getYoutubeStatus = requestBuilder<GetYoutubeStatusResponse>('GET', '/streamer/youtube/status', false)

export const setActiveLivestream = requestBuilder<SetActiveLivestreamResponse, SetActiveLivestreamRequest>('PATCH', `/streamer/livestream`, 'self')

export const getStatus = requestBuilder<GetStatusResponse>('GET', `/streamer/status`, 'self')

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

export const createLinkToken = requestBuilder<CreateLinkTokenResponse, false, [externalId: string]>(
  'POST',
  (externalId) => constructPath(`/user/link/token`, { externalId }),
  false
)

export const deleteLinkToken = requestBuilder<DeleteLinkTokenResponse, false, [linkToken: string]>(
  'DELETE',
  (linkToken) => constructPath(`/user/link/token`, { linkToken }),
  false
)

export const getAdministrativeMode = requestBuilder<GetAdministrativeModeResponse>('GET', '/admin/administrativeMode', false)

export const getTwitchAdminLoginUrl = requestBuilder<GetTwitchLoginUrlResponse>('GET', '/admin/twitch/login', false)

export const authoriseTwitchAdmin = requestBuilder<TwitchAuthorisationResponse, false, [code: string]>(
  'POST',
  (code) => constructPath('/admin/twitch/authorise', { code }),
  false
)

export const getYoutubeAdminLoginUrl = requestBuilder<GetYoutubeAdminLoginUrlResponse>('GET', '/admin/youtube/login', false)

export const authoriseYoutubeAdmin = requestBuilder<YoutubeAdminAuthorisationResponse, false, [code: string]>(
  'POST',
  (code) => constructPath('/admin/youtube/authorise', { code }),
  false
)

export const revokeYoutubeAdmin = requestBuilder<YoutubeAdminRevocationResponse>('POST', '/admin/youtube/revoke', false)

export const reconnectChatClient = requestBuilder<ReconnectTwitchChatClientResponse>('POST', '/admin/twitch/reconnectChatClient', false)

export const resetTwitchSubscriptions = requestBuilder<ResetTwitchSubscriptionsResponse>('POST', '/admin/twitch/resetSubscriptions', false)

export const getLinkAttemptLogs = requestBuilder<GetLinkAttemptLogsResponse>('GET', '/admin/link/logs', false)

export const releaseLinkAttempt = requestBuilder<ReleaseLinkAttemptResponse, false, [linkAttemptId: number]>(
  'POST',
  linkAttemptId => constructPath('/admin/link/release', { linkAttemptId }),
  false
)

export const getLivestreams = requestBuilder<GetLivestreamsResponse>('GET', '/livestream', true, false)

export const getChat = requestBuilder<GetChatResponse, false, [since?: number, limit?: number]>(
  'GET',
  (since, limit) => constructPath('/chat', { since, limit }),
  true,
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

  definedParams.forEach((pair, i) => path += `${i === 0 ? '?' : '&'}${pair[0]}=${pair[1]}`)
  return path
}
