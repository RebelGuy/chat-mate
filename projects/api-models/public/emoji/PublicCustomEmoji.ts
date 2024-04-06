import { PublicObject } from '@rebel/api-models/types'
import { SafeOmit } from '@rebel/shared/types'

export type PublicCustomEmoji = PublicObject<{
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

  /** The signed image url. */
  imageUrl: string

  /** The minimum level a user must be to unlock this emoji. */
  levelRequirement: number

  /** Whether this emoji can be referenced within a donation message - all other contraints will be ignored. */
  canUseInDonationMessage: boolean

  /** The list of ranks that are allowed to use the custom emoji. If empty, all ranks have access. */
  whitelistedRanks: number[]

  /** The position of this custom emoji relative to all other custom emojis. */
  sortOrder: number
}>

export type PublicCustomEmojiNew = SafeOmit<PublicCustomEmoji, 'id' | 'isActive' | 'version' | 'imageUrl'> & { imageDataUrl: string }

export type PublicCustomEmojiUpdate = SafeOmit<PublicCustomEmoji, 'symbol' | 'isActive' | 'version' | 'imageUrl'> & { imageDataUrl: string }
