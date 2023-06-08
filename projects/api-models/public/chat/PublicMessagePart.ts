import { PublicObject } from '@rebel/api-models/types'
import { PublicMessageCheer } from '@rebel/api-models/public/chat/PublicMessageCheer'
import { PublicMessageCustomEmoji } from '@rebel/api-models/public/chat/PublicMessageCustomEmoji'
import { PublicMessageEmoji } from '@rebel/api-models/public/chat/PublicMessageEmoji'
import { PublicMessageText } from '@rebel/api-models/public/chat/PublicMessageText'

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
