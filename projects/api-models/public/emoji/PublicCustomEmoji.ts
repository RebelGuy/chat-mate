import { PublicObject } from '@rebel/api-models/types'

export type PublicCustomEmoji = PublicObject<{
  /** The internal emoji id. An emoji is uniquely identified by an id-version pair. */
  id: number

  /** The current emoji version. */
  version: number

  /** The time at which the emoji was deleted, if any. If not null, the emoji is not currently active and is inaccessible to users. */
  deletedAt: number | null

  /** The human readable name of the emoji. */
  name: string

  /** The unique 3-10 character long symbol that identifies this emoji. */
  symbol: string

  /** The signed image url. */
  imageUrl: string

  /** The pixel width of the image. */
  imageWidth: number

  /** The pixel height of the image. */
  imageHeight: number

  /** The minimum level a user must be to unlock this emoji. */
  levelRequirement: number

  /** Whether this emoji can be referenced within a donation message - all other contraints will be ignored. */
  canUseInDonationMessage: boolean

  /** The list of ranks that are allowed to use the custom emoji. If empty, all ranks have access. */
  whitelistedRanks: number[]

  /** The position of this custom emoji relative to all other custom emojis. */
  sortOrder: number
}>
