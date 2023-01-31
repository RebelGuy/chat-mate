import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicMessageEmoji } from '@rebel/server/controllers/public/chat/PublicMessageEmoji'
import { PublicMessageText } from '@rebel/server/controllers/public/chat/PublicMessageText'
import { PublicCustomEmoji } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'

export type PublicMessageCustomEmoji = PublicObject<{
  /** The text content of this part, if applicable, in the form :<custom_emoji_symbol>:. */
  textData: PublicObject<PublicMessageText> | null

  /** The emoji content of this part, if applicable. */
  emojiData: PublicObject<PublicMessageEmoji> | null

  /** The custom emoji that this message part refers to. */
  customEmoji: PublicObject<PublicCustomEmoji>
}>
