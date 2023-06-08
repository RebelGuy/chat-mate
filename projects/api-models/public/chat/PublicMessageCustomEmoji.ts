import { PublicObject } from '@rebel/api-models/types'
import { PublicMessageEmoji } from '@rebel/api-models/public/chat/PublicMessageEmoji'
import { PublicMessageText } from '@rebel/api-models/public/chat/PublicMessageText'
import { PublicCustomEmoji } from '@rebel/api-models/public/emoji/PublicCustomEmoji'

export type PublicMessageCustomEmoji = PublicObject<{
  /** The text content of this part, if applicable, in the form :<custom_emoji_symbol>:. */
  textData: PublicObject<PublicMessageText> | null

  /** The emoji content of this part, if applicable. */
  emojiData: PublicObject<PublicMessageEmoji> | null

  /** The custom emoji that this message part refers to. */
  customEmoji: PublicObject<PublicCustomEmoji>
}>
