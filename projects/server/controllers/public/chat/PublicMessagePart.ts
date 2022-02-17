import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicMessageEmoji } from '@rebel/server/controllers/public/chat/PublicMessageEmoji'
import { PublicMessageText } from '@rebel/server/controllers/public/chat/PublicMessageText'

export type PublicMessagePart = PublicObject<1, {
  schema: 1

  /** Each part must be of a particular type. */
  type: 'text' | 'emoji'

  /** Only set if `type` is `text`. */
  textData: PublicMessageText | null

  /** Only set if `type` is `emoji`. */
  emojiData: PublicMessageEmoji | null
}>
