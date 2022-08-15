import { PublicObject, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'

export type PublicUserRank = PublicObject<1, {
  schema: 1

  rank: Tagged<1, PublicRank>

  /** The id of the user rank object. */
  id: number

  /** The time at which the rank was originally issued to the user. */
  issuedAt: number

  /** Whether the user rank is active. This is a convenience property that can be derived from other properties of the user rank. */
  isActive: boolean

  /** The time at which the user rank expires. Set to null if the user rank is permanent. */
  expirationTime: number | null

  /** The assignment message, if set. */
  message: string | null

  /** The time at which the user rank was revoked, if revoked. */
  revokedAt: number | null

  /** The user rank revoke message, if revoked and set. */
  revokeMessage: string | null
}>
