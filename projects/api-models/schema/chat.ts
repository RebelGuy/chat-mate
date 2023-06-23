import { PublicChatItem } from '@rebel/api-models/public/chat/PublicChatItem'
import { ApiResponse, PublicObject } from '@rebel/api-models/types'

export type GetChatResponse = ApiResponse<{
  // include the timestamp so it can easily be used for the next request
  reusableTimestamp: number
  chat: PublicObject<PublicChatItem>[]
}>

export type GetCommandStatusResponse = ApiResponse<{
  status: 'success' | 'error' | 'pending'
  message: string | null
  durationMs: number | null
}>
