import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicMessageCheer } from '@rebel/server/controllers/public/chat/PublicMessageCheer'
import { PublicMessageCustomEmoji } from '@rebel/server/controllers/public/chat/PublicMessageCustomEmoji'
import { PublicMessageEmoji } from '@rebel/server/controllers/public/chat/PublicMessageEmoji'
import { PublicMessageText } from '@rebel/server/controllers/public/chat/PublicMessageText'

export type PublicMessagePart = PublicObject<3, {
  schema: 3

  /** Each part must be of a particular type. */
  type: 'text' | 'emoji' | 'customEmoji' | 'cheer'

  /** Only set if `type` is `text`. */
  textData: Tagged<1, PublicMessageText> | null

  /** Only set if `type` is `emoji`. */
  emojiData: Tagged<1, PublicMessageEmoji> | null

  /** Only set if `type` is `customEmoji`. */
  customEmojiData: Tagged<2, PublicMessageCustomEmoji> | null

  /** Only set if `type` is `cheer`. */
  cheerData: Tagged<1, PublicMessageCheer> | null
}>
