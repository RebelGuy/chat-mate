import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicMessageEmoji } from '@rebel/server/controllers/public/chat/PublicMessageEmoji'
import { PublicMessageText } from '@rebel/server/controllers/public/chat/PublicMessageText'
import { PublicCustomEmoji } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'

export type PublicMessageCustomEmoji = PublicObject<2, {
  schema: 2

  /** The text content of this part, if applicable, in the form :<custo_emoji_symbol>:. */
  textData: PublicMessageText | null

  /** The emoji content of this part, if applicable. */
  emojiData: PublicMessageEmoji | null

  /** The custom emoji that this message part refers to. */
  customEmoji: PublicCustomEmoji
}>
