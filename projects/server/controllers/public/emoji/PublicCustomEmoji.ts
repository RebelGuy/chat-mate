import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicCustomEmoji = PublicObject<1, {
  schema: 1

  /** The internal emoji id. An emoji is uniquely identified by an id-version pair. */
  id: number

  /** The current emoji version. */
  version: number

  /** Whether the emoji is currently active and accessible to users. */
  isActive: boolean

  /** The human readable name of the emoji. */
  name: string

  /** The unique 3-10 character long symbol that identifies this emoji. */
  symbol: string

  /** The Base64 encoded image data, created directly from the buffer. */
  imageData: string

  /** The minimum level a user must be to unlock this emoji. */
  levelRequirement: number

  /** Whether this emoji can be referenced within a donation message - all other contraints will be ignored. */
  canUseInDonationMessage: boolean

  /** The list of ranks that are allowed to use the custom emoji. If empty, all ranks have access. */
  whitelistedRanks: number[]
}>

export type PublicCustomEmojiNew = Omit<PublicCustomEmoji, 'id' | 'isActive' | 'version' | 'streamerId'>

export type PublicCustomEmojiUpdate = Omit<PublicCustomEmoji, 'symbol' | 'isActive' | 'version'>
