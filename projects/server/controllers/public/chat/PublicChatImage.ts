import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicChatImage = PublicObject<{
  /** The image url for the emoji. May be an SVG. */
  url: string

  /* Pixel width of the image at the url. Null if the url is for an SVG. */
  width: number | null

  /* Pixel height of the image at the url. Null if the url is for an SVG. */
  height: number | null
}>
