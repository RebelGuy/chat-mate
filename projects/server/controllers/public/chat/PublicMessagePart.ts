import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicMessageCheer } from '@rebel/server/controllers/public/chat/PublicMessageCheer'
import { PublicMessageCustomEmoji } from '@rebel/server/controllers/public/chat/PublicMessageCustomEmoji'
import { PublicMessageEmoji } from '@rebel/server/controllers/public/chat/PublicMessageEmoji'
import { PublicMessageText } from '@rebel/server/controllers/public/chat/PublicMessageText'

export type PublicMessagePart = PublicObject<{
  /** Each part must be of a particular type. */
  type: 'text' | 'emoji' | 'customEmoji' | 'cheer'

  /** Only set if `type` is `text`. */
  textData: PublicObject<PublicMessageText> | null

  /** Only set if `type` is `emoji`. */
  emojiData: PublicObject<PublicMessageEmoji> | null

  /** Only set if `type` is `customEmoji`. */
  customEmojiData: PublicObject<PublicMessageCustomEmoji> | null

  /** Only set if `type` is `cheer`. */
  cheerData: PublicObject<PublicMessageCheer> | null
}>
