import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicChatImage } from '@rebel/server/controllers/public/chat/PublicChatImage'

export type PublicMessageEmoji = PublicObject<1, {
  schema: 1

  /** The hover-over name of the emoji, or the emoji character itself. */
  name: string

  /** Short emoji label, usually the shortcut text (e.g. `:slightly_smiling:`). */
  label: string

  /** An image to the emoji. */
  image: Tagged<1, PublicChatImage>
}>
