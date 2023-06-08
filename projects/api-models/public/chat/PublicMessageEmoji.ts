import { PublicObject } from '@rebel/api-models/types'
import { PublicChatImage } from '@rebel/api-models/public/chat/PublicChatImage'

export type PublicMessageEmoji = PublicObject<{
  /** The hover-over name of the emoji, or the emoji character itself. */
  name: string

  /** Short emoji label, usually the shortcut text (e.g. `:slightly_smiling:`). */
  label: string

  /** An image to the emoji. */
  image: PublicObject<PublicChatImage>
}>
