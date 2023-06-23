import { PublicCustomEmoji, PublicCustomEmojiNew, PublicCustomEmojiUpdate } from '@rebel/api-models/public/emoji/PublicCustomEmoji'
import { ApiResponse, PublicObject, ApiRequest } from '@rebel/api-models/types'

export type GetCustomEmojisResponse = ApiResponse<{ emojis: PublicObject<PublicCustomEmoji>[] }>

export type AddCustomEmojiRequest = ApiRequest<{ newEmoji: PublicObject<PublicCustomEmojiNew> }>
export type AddCustomEmojiResponse = ApiResponse<{ newEmoji: PublicObject<PublicCustomEmoji> }>

export type UpdateCustomEmojiRequest = ApiRequest<{ updatedEmoji: PublicObject<PublicCustomEmojiUpdate> }>
export type UpdateCustomEmojiResponse = ApiResponse<{ updatedEmoji: PublicObject<PublicCustomEmoji> }>

