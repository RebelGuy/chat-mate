import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicCustomEmoji = PublicObject<1, {
  schema: 1

  /** The internal emoji id. This changes for every version of the emoji. */
  id: number

  /** The current emoji version. */
  version: number

  /** Whether the emoji is currentl active and accessible to users. */
  isActive: boolean

  /** The human readable name of the emoji. */
  name: string

  /** The unique 3-10 character long symbol that identifies this emoji. */
  symbol: string

  /** The Base64 encoded image data, created directly from the buffer. */
  imageData: string

  /** The minimum level a user must be to unlock this emoji. */
  levelRequirement: number

  /** The list of ranks that are allowed to use the custom emoji. If empty, all ranks have access. */
  whitelistedRanks: number[]
}>

export type PublicCustomEmojiNew = Omit<PublicCustomEmoji, 'id' | 'isActive' | 'version'>

export type PublicCustomEmojiUpdate = Omit<PublicCustomEmoji, 'symbol' | 'isActive' | 'version'>
