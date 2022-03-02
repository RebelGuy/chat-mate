import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicMessageCustomEmoji } from '@rebel/server/controllers/public/chat/PublicMessageCustomEmoji'
import { PublicMessageEmoji } from '@rebel/server/controllers/public/chat/PublicMessageEmoji'
import { PublicMessageText } from '@rebel/server/controllers/public/chat/PublicMessageText'
import { PublicCustomEmoji } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'

export type PublicMessagePart = PublicObject<2, {
  schema: 2

  /** Each part must be of a particular type. */
  type: 'text' | 'emoji' | 'customEmoji'

  /** Only set if `type` is `text`. */
  textData: PublicMessageText | null

  /** Only set if `type` is `emoji`. */
  emojiData: PublicMessageEmoji | null

  /** Only set if `type` is `customEmoji`. */
  customEmojiData: PublicMessageCustomEmoji | null
}>
