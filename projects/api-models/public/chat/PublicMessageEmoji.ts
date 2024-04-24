import { PublicObject } from '@rebel/api-models/types'
import { PublicChatImage } from '@rebel/api-models/public/chat/PublicChatImage'

export type PublicMessageEmoji = PublicObject<{
  /** The internal ID of the emoji. */
  id: number

  /** The hover-over name of the emoji, or the emoji character itself. */
  name: string

  /** Short emoji label, usually the shortcut text (e.g. `:slightly_smiling:`). */
  label: string

  /** An image to the emoji. Null if unavailable or inaccessible. */
  image: PublicChatImage | null
}>
