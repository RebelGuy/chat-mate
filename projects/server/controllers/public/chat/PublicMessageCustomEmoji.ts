import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicMessageText } from '@rebel/server/controllers/public/chat/PublicMessageText'
import { PublicCustomEmoji } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'

export type PublicMessageCustomEmoji = PublicObject<1, {
  schema: 1

  /** The text content of this part, in the form :<custo_emoji_symbol>:. */
  textData: PublicMessageText

  /** The custom emoji that this message part refers to. */
  customEmoji: PublicCustomEmoji
}>
