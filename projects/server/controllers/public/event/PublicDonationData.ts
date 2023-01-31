import { PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicMessagePart } from '@rebel/server/controllers/public/chat/PublicMessagePart'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

/** Represents an unlinked donation. */
export type PublicDonationData = PublicObject<{
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
  messageParts: PublicObject<PublicMessagePart>[]

  /** The internal user linked to the donation. Null if the donation has not been linked to any user. */
  linkedUser: PublicObject<PublicUser> | null
}>
