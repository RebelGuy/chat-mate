import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicPunishment = PublicObject<1, {
  schema: 1

  /** The type of the punishment. */
  type: 'ban' | 'timeout'

  /** The time at which the punishment was originally issued. */
  issuedAt: number

  /** The time at which the punishment expires. Set to null if the punishment is permanent. */
  expirationTime: number | null

  /** The punishment message, if set. */
  message: string | null

  /** The time at which the punishment was revoked, if revoked. */
  revokedAt: number | null

  /** The punishment revoke message, if revoked and set. */
  revokeMessage: string | null
}>
