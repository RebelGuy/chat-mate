import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicMessageText = PublicObject<{
  /** The text content of this part. */
  text: string

  /** Whether the text has bold formatting. */
  isBold: boolean

  /** Whether the text has italics formatting. */
  isItalics: boolean
}>
