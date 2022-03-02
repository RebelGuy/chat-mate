import { AddCustomEmojiRequest, AddCustomEmojiResponse, GetCustomEmojisResponse, UpdateCustomEmojiRequest, UpdateCustomEmojiResponse } from '@rebel/server/controllers/EmojiController'
import { PublicCustomEmoji, PublicCustomEmojiNew } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'

const baseUrl = 'http://localhost:3010/api'

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