import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'

/** Represents an unlinked donation. */
export type PublicDonation = PublicObject<1, {
  schema: 1

  /** The internal ID associated with the underlying donation. */
  id: number

  /** The timestamp at which the donation occurred. */
  time: number

  /** The donation amount (decimal number). */
  amount: number

  /** The donation currency code. At the moment, it's always 'USD'. */
  currency: 'USD'

  /** The name of the user that posted the donation. */
  name: string

  /** The custom message attached to the donation, if any. */
  message: string | null

  /** The internal user linked to the donation. Null if the donation has not been linked to any user. */
  linkedUser: Tagged<3, PublicUser> | null
}>
