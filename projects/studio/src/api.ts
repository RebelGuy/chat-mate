import { AddCustomEmojiRequest, AddCustomEmojiResponse, GetCustomEmojisResponse, UpdateCustomEmojiRequest, UpdateCustomEmojiResponse } from '@rebel/server/controllers/EmojiController'
import { GetMasterchatAuthenticationResponse, GetStatusResponse, PingResponse, SetActiveLivestreamRequest, SetActiveLivestreamResponse } from '@rebel/server/controllers/ChatMateController'
import { GetTimestampsResponse } from '@rebel/server/controllers/LogController'
import { GetAccessibleRanksResponse } from '@rebel/server/controllers/RankController'
import { PublicCustomEmojiNew } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { SERVER_URL } from '@rebel/studio/global'
import { AuthenticateResponse, LoginRequest, LoginResponse, LogoutResponse, RegisterRequest, RegisterResponse } from '@rebel/server/controllers/AccountController'

const baseUrl = SERVER_URL + '/api'

export async function getAllCustomEmojis (): Promise<GetCustomEmojisResponse> {
  return await get('/emoji/custom')
}

export async function updateCustomEmoji (updatedEmoji: UpdateCustomEmojiRequest['updatedEmoji']): Promise<UpdateCustomEmojiResponse> {
  const request: UpdateCustomEmojiRequest = {
    schema: 1,
    updatedEmoji
  }

  return await post('/emoji/custom', request)
}

export async function addCustomEmoji (newEmoji: PublicCustomEmojiNew): Promise<AddCustomEmojiResponse> {
  const request: AddCustomEmojiRequest = {
    schema: 1,
    newEmoji
  }

  return await post('/emoji/custom', request)
}

export async function setActiveLivestream (newLivestream: string | null): Promise<SetActiveLivestreamResponse> {
  const request: SetActiveLivestreamRequest = {
    schema: 2,
    livestream: newLivestream
  }

  return await post('/chatMate/livestream', request)
}

export async function ping (): Promise<PingResponse> {
  return await get('/chatMate/ping')
}

export async function getMasterchatAuthentication (): Promise<GetMasterchatAuthenticationResponse> {
  return await get('/chatMate/masterchat/authentication')
}

export async function getStatus (): Promise<GetStatusResponse> {
  return await get('/chatMate/status')
}

export async function getLogTimestamps (): Promise<GetTimestampsResponse> {
  return await get('/log/timestamps')
}

export async function getAccessibleRanks (): Promise<GetAccessibleRanksResponse> {
  return await get('/rank/accessible')
}

export async function registerAccount (username: string, password: string): Promise<RegisterResponse> {
  const request: RegisterRequest = { schema: 1, username, password }
  return await post('/account/register', request)
}

export async function login (username: string, password: string): Promise<LoginResponse> {
  const request: LoginRequest = { schema: 1, username, password }
  return await post('/account/login', request)
}

export async function logout (): Promise<LogoutResponse> {
  return await post('/account/logout', {})
}

export async function authenticate (loginToken: string): Promise<AuthenticateResponse> {
  return await post('/account/authenticate', { loginToken })
}

async function get (path: string): Promise<any> {
  const response = await fetch(baseUrl + path, { method: 'GET' })
  const body = await response.text()
  return JSON.parse(body)
}

async function post (path: string, requestData: any): Promise<any> {
  const response = await fetch(baseUrl + path, {
    method: 'POST',
    body: JSON.stringify(requestData),
    headers: {
      'Content-Type': 'application/json'
    }
  })
  const body = await response.text()
  return JSON.parse(body)
}
