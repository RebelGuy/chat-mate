import { AddCustomEmojiRequest, AddCustomEmojiResponse, GetCustomEmojisResponse, UpdateCustomEmojiRequest, UpdateCustomEmojiResponse } from '@rebel/server/controllers/EmojiController'
import { GetStatusResponse, SetActiveLivestreamRequest, SetActiveLivestreamResponse } from '@rebel/server/controllers/ChatMateController'
import { GetTimestampsResponse } from '@rebel/server/controllers/LogController'
import { PublicCustomEmoji, PublicCustomEmojiNew } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { SERVER_API_URL } from '@rebel/studio/global'

const baseUrl = SERVER_API_URL

export async function getAllCustomEmojis (): Promise<GetCustomEmojisResponse> {
  const response = await fetch(baseUrl + '/emoji/custom')
  const body = await response.text()
  return JSON.parse(body)
}

export async function updateCustomEmoji (updatedEmoji: PublicCustomEmoji): Promise<UpdateCustomEmojiResponse> {
  const request: UpdateCustomEmojiRequest = {
    schema: 1,
    updatedEmoji
  }

  const response = await fetch(baseUrl + '/emoji/custom', {
    method: 'PATCH',
    body: JSON.stringify(request),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  })
  const body = await response.text()
  return JSON.parse(body)
}

export async function addCustomEmoji (newEmoji: PublicCustomEmojiNew): Promise<AddCustomEmojiResponse> {
  const request: AddCustomEmojiRequest = {
    schema: 1,
    newEmoji
  }

  const response = await fetch(baseUrl + '/emoji/custom', {
    method: 'POST',
    body: JSON.stringify(request),
    headers: {
      'Content-Type': 'application/json'
    }
  })
  const body = await response.text()
  return JSON.parse(body)
}

export async function setActiveLivestream (newLivestream: string | null): Promise<SetActiveLivestreamResponse> {
  const request: SetActiveLivestreamRequest = {
    schema: 2,
    livestream: newLivestream
  }

  const response = await fetch(baseUrl + '/chatMate/livestream', {
    method: 'PATCH',
    body: JSON.stringify(request),
    headers: {
      'Content-Type': 'application/json'
    }
  })
  const body = await response.text()
  return JSON.parse(body)
}

export async function getStatus (): Promise<GetStatusResponse> {
  const response = await fetch(baseUrl + '/chatMate/status', { method: 'GET' })
  const body = await response.text()
  return JSON.parse(body)
}

export async function getLogTimestamps (): Promise<GetTimestampsResponse> {
  const response = await fetch(baseUrl + '/log/timestamps', { method: 'GET' })
  const body = await response.text()
  return JSON.parse(body)
}
