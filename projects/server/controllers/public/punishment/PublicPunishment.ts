import { PublicObject } from '@rebel/server/controllers/ControllerBase'

export type PublicPunishment = PublicObject<1, {
  schema: 1

  /** The id of the punishment object. */
  id: number

  /** The type of the punishment.
   * `ban`: User is permanently banned on the external platforms. No chat will come through.
   * `timeout`: User is timed out on the external platforms for a period of time. No chat will come through.
   * `mute`: User is not punished on external platforms, and chat will still come through. For internal use only.
  */
  type: 'ban' | 'timeout' | 'mute'

  /** The time at which the punishment was originally issued. */
  issuedAt: number

  /** Whether the punishment is active. This is a convenience property that can be derived from other properties of the punishment. */
  isActive: boolean

  /** The time at which the punishment expires. Set to null if the punishment is permanent. */
  expirationTime: number | null

  /** The punishment message, if set. */
  message: string | null

  /** The time at which the punishment was revoked, if revoked. */
  revokedAt: number | null

  /** The punishment revoke message, if revoked and set. */
  revokeMessage: string | null
}>
