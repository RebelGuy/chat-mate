import { PublicObject } from '@rebel/api-models/types'

export type PublicChatImage = PublicObject<{
  /** The internal ID of the image. */
  id: number

  /** The S3 image url for the emoji. */
  url: string

  /* Pixel width of the image at the url. */
  width: number

  /* Pixel height of the image at the url. */
  height: number
}>
