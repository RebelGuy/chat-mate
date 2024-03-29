import { PublicObject } from '@rebel/api-models/types'
import { PublicMessagePart } from '@rebel/api-models/public/chat/PublicMessagePart'
import { PublicUser } from '@rebel/api-models/public/user/PublicUser'

/** Represents an unlinked donation. */
export type PublicDonation = PublicObject<{
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

  /** Donations with the same link identifier will always either be unlinked together, or linked together to the same user. */
  linkIdentifier: string

  /** The internal user linked to the donation. Null if the donation has not been linked to any user. */
  linkedUser: PublicObject<PublicUser> | null

  /** The timestamp at which the currently linked user was linked. This is the exact time at which any rank changes would have occurred. Null if no user is currently linked. */
  linkedAt: number | null

  /** The timestamp at which the donation was refunded by the streamer. Null if the donation is not refunded. */
  refundedAt: number | null

  /** The timestamp at which the donation was deleted by the streamer. Null if the donation is not deleted. */
  deletedAt: number | null
}>
