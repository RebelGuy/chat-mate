import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicCustomEmoji = PublicObject<1, {
  schema: 1

  /** The internal emoji id. */
  id: number,

  /** The human readable name of the emoji. */
  name: string,

  /** The unique 3-10 character long symbol that identifies this emoji. */
  symbol: string,

  /** The UTF-8 encoded image data, created directly from the buffer. */
  imageData: string

  /** The minimum level a user must be to unlock this emoji. */
  levelRequirement: number
}>

export type PublicCustomEmojiNew = Omit<PublicCustomEmoji, 'id'>
