import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicMessageEmoji } from '@rebel/server/controllers/public/chat/PublicMessageEmoji'
import { PublicMessageText } from '@rebel/server/controllers/public/chat/PublicMessageText'
import { PublicCustomEmoji } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'

export type PublicMessageCustomEmoji = PublicObject<2, {
  schema: 2

  /** The text content of this part, if applicable, in the form :<custo_emoji_symbol>:. */
  textData: Tagged<1, PublicMessageText> | null

  /** The emoji content of this part, if applicable. */
  emojiData: Tagged<1, PublicMessageEmoji> | null

  /** The custom emoji that this message part refers to. */
  customEmoji: Tagged<1, PublicCustomEmoji>
}>
