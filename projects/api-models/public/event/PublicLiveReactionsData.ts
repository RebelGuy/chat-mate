import { PublicChatImage } from '@rebel/api-models/public/chat/PublicChatImage'
import { PublicObject } from '@rebel/api-models/types'

export type PublicLiveReactionsData = PublicObject<{
  /** The internal ID of the emoji to which this reaction belongs. */
  emojiId: number

  /** The emoji image of this reaction. */
  emojiImage: PublicChatImage

  /** The number of reactions using this emoji in last 1 second. */
  reactionCount: number
}>
