import { AddCustomEmojiRequest, AddCustomEmojiResponse, GetCustomEmojisResponse, UpdateCustomEmojiRequest, UpdateCustomEmojiResponse } from '@rebel/server/controllers/EmojiController'
import { GetMasterchatAuthenticationResponse, GetStatusResponse, PingResponse, SetActiveLivestreamRequest, SetActiveLivestreamResponse } from '@rebel/server/controllers/ChatMateController'
import { GetAccessibleRanksResponse, GetUserRanksResponse } from '@rebel/server/controllers/RankController'
import { ApproveApplicationRequest, ApproveApplicationResponse, CreateApplicationRequest, CreateApplicationResponse, GetApplicationsResponse, GetPrimaryChannelsResponse, GetStreamersResponse, RejectApplicationRequest, RejectApplicationResponse, SetPrimaryChannelResponse, UnsetPrimaryChannelResponse, WithdrawApplicationRequest, WithdrawApplicationResponse } from '@rebel/server/controllers/StreamerController'
import { PublicCustomEmojiNew } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { SERVER_URL } from '@rebel/studio/utility/global'
import { AuthenticateResponse, LoginRequest, LoginResponse, LogoutResponse, RegisterRequest, RegisterResponse } from '@rebel/server/controllers/AccountController'
import { GetStreamlabsStatusResponse, SetWebsocketTokenRequest, SetWebsocketTokenResponse } from '@rebel/server/controllers/DonationController'
import { GetLinkHistoryResponse, CreateLinkTokenResponse, GetLinkedChannelsResponse, RemoveLinkedChannelResponse, SearchUserResponse, SearchUserRequest, AddLinkedChannelResponse } from '@rebel/server/controllers/UserController'
import { GenericObject } from '@rebel/shared/types'

const LOGIN_TOKEN_HEADER = 'X-Login-Token'
const STREAMER_HEADER = 'X-Streamer'

const baseUrl = SERVER_URL + '/api'

export async function getAllCustomEmojis (loginToken: string, streamer: string): Promise<GetCustomEmojisResponse> {
  return await GET('/emoji/custom', loginToken, streamer)
}

export async function updateCustomEmoji (updatedEmoji: UpdateCustomEmojiRequest['updatedEmoji'], loginToken: string, streamer: string): Promise<UpdateCustomEmojiResponse> {
  const request: UpdateCustomEmojiRequest = { updatedEmoji }

  return await PATCH('/emoji/custom', request, loginToken, streamer)
}

export async function addCustomEmoji (newEmoji: PublicCustomEmojiNew, loginToken: string, streamer: string): Promise<AddCustomEmojiResponse> {
  const request: AddCustomEmojiRequest = { newEmoji }

  return await POST('/emoji/custom', request, loginToken, streamer)
}

export async function setActiveLivestream (newLivestream: string | null, loginToken: string, streamer: string): Promise<SetActiveLivestreamResponse> {
  const request: SetActiveLivestreamRequest = { livestream: newLivestream }

  return await PATCH('/chatMate/livestream', request, loginToken, streamer)
}

export async function ping (): Promise<PingResponse> {
  return await GET('/chatMate/ping')
}

export async function getMasterchatAuthentication (loginToken: string): Promise<GetMasterchatAuthenticationResponse> {
  return await GET('/chatMate/masterchat/authentication', loginToken)
}

export async function getStatus (loginToken: string, streamer: string): Promise<GetStatusResponse> {
  return await GET('/chatMate/status', loginToken, streamer)
}

export async function getAccessibleRanks (loginToken: string, streamer: string): Promise<GetAccessibleRanksResponse> {
  return await GET('/rank/accessible', loginToken, streamer)
}

/** Gets global ranks if the streamer is not provided. */
export async function getRanks (loginToken: string, streamer?: string): Promise<GetUserRanksResponse> {
  return await GET('/rank', loginToken, streamer)
}

export async function registerAccount (username: string, password: string): Promise<RegisterResponse> {
  const request: RegisterRequest = { username, password }
  return await POST('/account/register', request)
}

export async function login (username: string, password: string): Promise<LoginResponse> {
  const request: LoginRequest = { username, password }
  return await POST('/account/login', request)
}

export async function logout (loginToken: string): Promise<LogoutResponse> {
  return await POST('/account/logout', {}, loginToken)
}

export async function authenticate (loginToken: string): Promise<AuthenticateResponse> {
  return await POST('/account/authenticate', {}, loginToken)
}

export async function getStreamers (loginToken: string): Promise<GetStreamersResponse> {
  return await GET('/streamer', loginToken)
}

export async function getStreamerApplications (loginToken: string): Promise<GetApplicationsResponse> {
  return await GET('/streamer/application', loginToken)
}

export async function createStreamerApplication (loginToken: string, message: string): Promise<CreateApplicationResponse> {
  const request: CreateApplicationRequest = { message }
  return await POST('/streamer/application', request, loginToken)
}

export async function approveStreamerApplication (loginToken: string, applicationId: number, message: string): Promise<ApproveApplicationResponse> {
  const request: ApproveApplicationRequest = { message }
  return await POST(`/streamer/application/${applicationId}/approve`, request, loginToken)
}

export async function rejectStreamerApplication (loginToken: string, applicationId: number, message: string): Promise<RejectApplicationResponse> {
  const request: RejectApplicationRequest = { message }
  return await POST(`/streamer/application/${applicationId}/reject`, request, loginToken)
}

export async function withdrawStreamerApplication (loginToken: string, applicationId: number, message: string): Promise<WithdrawApplicationResponse> {
  const request: WithdrawApplicationRequest = { message }
  return await POST(`/streamer/application/${applicationId}/withdraw`, request, loginToken)
}

export async function getPrimaryChannels (loginToken: string): Promise<GetPrimaryChannelsResponse> {
  return await GET(`/streamer/primaryChannels`, loginToken)
}

export async function setPrimaryChannel (loginToken: string, platform: 'youtube' | 'twitch', channelId: number): Promise<SetPrimaryChannelResponse> {
  return await POST(`/streamer/primaryChannels/${platform}/${channelId}`, null, loginToken)
}

export async function unsetPrimaryChannel (loginToken: string, platform: 'youtube' | 'twitch'): Promise<UnsetPrimaryChannelResponse> {
  return await DELETE(`/streamer/primaryChannels/${platform}`, null, loginToken)
}

export async function setStreamlabsSocketToken (loginToken: string, streamer: string, socketToken: string | null): Promise<SetWebsocketTokenResponse> {
  const request: SetWebsocketTokenRequest = { websocketToken: socketToken }
  return await POST(`/donation/streamlabs/socketToken`, request, loginToken, streamer)
}

export async function getStreamlabsStatus (loginToken: string, streamer: string): Promise<GetStreamlabsStatusResponse> {
  return await GET(`/donation/streamlabs/status`, loginToken, streamer)
}

export async function searchUser (loginToken: string, streamer: string, searchTerm: string): Promise<SearchUserResponse> {
  const request: SearchUserRequest = { searchTerm }
  return await POST(`/user/search`, request, loginToken, streamer)
}

export async function searchRegisteredUser (loginToken: string, streamer: string, searchTerm: string): Promise<SearchUserResponse> {
  const request: SearchUserRequest = { searchTerm }
  return await POST(`/user/search/registered`, request, loginToken, streamer)
}

export async function getLinkedChannels (loginToken: string, admin_aggregateUserId?: number): Promise<GetLinkedChannelsResponse> {
  return await GET(constructPath('/user/link/channels', { admin_aggregateUserId: admin_aggregateUserId }), loginToken)
}

export async function addLinkedChannel (loginToken: string, aggregateUserId: number, defaultUserId: number): Promise<AddLinkedChannelResponse> {
  return await POST(constructPath(`/user/link/channels/${aggregateUserId}/${defaultUserId}`), null, loginToken)
}

export async function removeLinkedChannel (loginToken: string, defaultUserId: number, transferRanks: boolean, relinkChatExperience: boolean, relinkDonations: boolean): Promise<RemoveLinkedChannelResponse> {
  const queryParams = { transferRanks: transferRanks, relinkChatExperience: relinkChatExperience, relinkDonations: relinkDonations }
  return await DELETE(constructPath(`/user/link/channels/${defaultUserId}`, queryParams), null, loginToken)
}

export async function getLinkHistory (loginToken: string, admin_aggregateUserId?: number): Promise<GetLinkHistoryResponse> {
  return await GET(constructPath('/user/link/history', { admin_aggregateUserId: admin_aggregateUserId }), loginToken)
}

export async function createLinkToken (loginToken: string, externalId: string): Promise<CreateLinkTokenResponse> {
  return await POST(`/user/link/token?externalId=${externalId}`, null, loginToken)
}

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
