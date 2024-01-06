import { PublicObject } from '@rebel/api-models/types'

export type PublicChatMessageDeletedData = PublicObject<{
  /** The id of the chat message that was deleted. */
  chatMessageId: number
}>
