import { PublicObject } from '@rebel/server/controllers/ControllerBase'

/** Represents an unlinked donation. */
export type PublicDonationData = PublicObject<1, {
  schema: 1

  /** The internal ID associated with the underlying donation. */
  id: number

  /** The timestamp at which the donation occurred. */
  time: number

  /** The donation amount (decimal number). */
  amount: number

  /** The human readable representation of the donation amount. */
  formattedAmount: string

  /** The donation currency code. */
  currency: string

  /** The name of the user that posted the donation. */
  name: string

  /** The custom message attached to the donation, if any. */
  message: string | null
}>
