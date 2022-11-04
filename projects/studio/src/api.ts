import { AddCustomEmojiRequest, AddCustomEmojiResponse, GetCustomEmojisResponse, UpdateCustomEmojiRequest, UpdateCustomEmojiResponse } from '@rebel/server/controllers/EmojiController'
import { GetMasterchatAuthenticationResponse, GetStatusResponse, PingResponse, SetActiveLivestreamRequest, SetActiveLivestreamResponse } from '@rebel/server/controllers/ChatMateController'
import { GetTimestampsResponse } from '@rebel/server/controllers/LogController'
import { GetAccessibleRanksResponse } from '@rebel/server/controllers/RankController'
import { ApproveApplicationRequest, ApproveApplicationResponse, CreateApplicationRequest, CreateApplicationResponse, GetApplicationsResponse, RejectApplicationRequest, RejectApplicationResponse, WithdrawApplicationRequest, WithdrawApplicationResponse } from '@rebel/server/controllers/StreamerController'
import { PublicCustomEmojiNew } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { SERVER_URL } from '@rebel/studio/global'
import { AuthenticateResponse, LoginRequest, LoginResponse, LogoutResponse, RegisterRequest, RegisterResponse } from '@rebel/server/controllers/AccountController'

const LOGIN_TOKEN_HEADER = 'X-Login-Token'

const baseUrl = SERVER_URL + '/api'

export async function getAllCustomEmojis (loginToken: string): Promise<GetCustomEmojisResponse> {
  return await get('/emoji/custom', loginToken)
}

export async function updateCustomEmoji (updatedEmoji: UpdateCustomEmojiRequest['updatedEmoji'], loginToken: string): Promise<UpdateCustomEmojiResponse> {
  const request: UpdateCustomEmojiRequest = {
    schema: 1,
    updatedEmoji
  }

  return await post('/emoji/custom', request, loginToken)
}

export async function addCustomEmoji (newEmoji: PublicCustomEmojiNew, loginToken: string): Promise<AddCustomEmojiResponse> {
  const request: AddCustomEmojiRequest = {
    schema: 1,
    newEmoji
  }

  return await post('/emoji/custom', request, loginToken)
}

export async function setActiveLivestream (newLivestream: string | null, loginToken: string): Promise<SetActiveLivestreamResponse> {
  const request: SetActiveLivestreamRequest = {
    schema: 2,
    livestream: newLivestream
  }

  return await patch('/chatMate/livestream', request, loginToken)
}

export async function ping (): Promise<PingResponse> {
  return await get('/chatMate/ping')
}

export async function getMasterchatAuthentication (loginToken: string): Promise<GetMasterchatAuthenticationResponse> {
  return await get('/chatMate/masterchat/authentication', loginToken)
}

export async function getStatus (loginToken: string): Promise<GetStatusResponse> {
  return await get('/chatMate/status', loginToken)
}

export async function getLogTimestamps (loginToken: string): Promise<GetTimestampsResponse> {
  return await get('/log/timestamps', loginToken)
}

export async function getAccessibleRanks (loginToken: string): Promise<GetAccessibleRanksResponse> {
  return await get('/rank/accessible', loginToken)
}

export async function registerAccount (username: string, password: string): Promise<RegisterResponse> {
  const request: RegisterRequest = { schema: 1, username, password }
  return await post('/account/register', request)
}

export async function login (username: string, password: string): Promise<LoginResponse> {
  const request: LoginRequest = { schema: 1, username, password }
  return await post('/account/login', request)
}

export async function logout (loginToken: string): Promise<LogoutResponse> {
  return await post('/account/logout', {}, loginToken)
}

export async function authenticate (loginToken: string): Promise<AuthenticateResponse> {
  return await post('/account/authenticate', {}, loginToken)
}

export async function getStreamerApplications (loginToken: string): Promise<GetApplicationsResponse> {
  return await get('/streamer/application', loginToken)
}

export async function createStreamerApplication (loginToken: string, message: string): Promise<CreateApplicationResponse> {
  const request: CreateApplicationRequest = { schema: 1, message }
  return await post('/streamer/application', request, loginToken)
}

export async function approveStreamerApplication (loginToken: string, applicationId: number, message: string): Promise<ApproveApplicationResponse> {
  const request: ApproveApplicationRequest = { schema: 1, message }
  return await post(`/streamer/application/${applicationId}/approve`, request, loginToken)
}

export async function rejectStreamerApplication (loginToken: string, applicationId: number, message: string): Promise<RejectApplicationResponse> {
  const request: RejectApplicationRequest = { schema: 1, message }
  return await post(`/streamer/application/${applicationId}/reject`, request, loginToken)
}

export async function withdrawStreamerApplication (loginToken: string, applicationId: number, message: string): Promise<WithdrawApplicationResponse> {
  const request: WithdrawApplicationRequest = { schema: 1, message }
  return await post(`/streamer/application/${applicationId}/withdraw`, request, loginToken)
}

async function get (path: string, loginToken?: string): Promise<any> {
  return await request('GET', path, undefined, loginToken)
}

async function post (path: string, requestData: any, loginToken?: string): Promise<any> {
  return await request('POST', path, requestData, loginToken)
}

async function patch (path: string, requestData: any, loginToken?: string): Promise<any> {
  return await request('PATCH', path, requestData, loginToken)
}

async function request (method: string, path: string, requestData: any | undefined, loginToken: string | undefined) {
  let headers: HeadersInit = {
    'Content-Type': 'application/json'
  }
  if (loginToken != null) {
    headers[LOGIN_TOKEN_HEADER] = loginToken
  }

  const response = await fetch(baseUrl + path, {
    method: method,
    body: requestData == null ? undefined : JSON.stringify(requestData),
    headers: headers
  })
  const body = await response.text()
  return JSON.parse(body)
}
