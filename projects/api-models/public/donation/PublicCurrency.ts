import { PublicObject } from '@rebel/api-models/types'

export type PublicCurrency = PublicObject<{
  /** The unique currency code that identifies this currency, e.g. "AUD".  */
  code: string

  /** The human readable name of the currency, e.g. "Australian Dollar". */
  description: string
}>
