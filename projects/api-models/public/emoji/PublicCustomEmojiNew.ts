import { PublicObject } from '@rebel/api-models/types'

export type PublicCustomEmojiNew = PublicObject<{
  /** The human readable name of the emoji. */
  name: string

  /** The unique 3-10 character long symbol that identifies this emoji. */
  symbol: string

  /** The minimum level a user must be to unlock this emoji. */
  levelRequirement: number

  /** Whether this emoji can be referenced within a donation message - all other contraints will be ignored. */
  canUseInDonationMessage: boolean

  /** The list of ranks that are allowed to use the custom emoji. If empty, all ranks have access. */
  whitelistedRanks: number[]

  /** The position of this custom emoji relative to all other custom emojis. */
  sortOrder: number

  /** The base64-encoded data URL of the image (must not be a HTTP URL). */
  imageDataUrl: string
}>
