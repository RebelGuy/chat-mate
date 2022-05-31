import { Punishment } from '@prisma/client'
import { PublicPunishment } from '@rebel/server/controllers/public/punishment/PublicPunishment'

export function punishmentToPublicObject (punishment: Punishment): PublicPunishment {
  return {
    schema: 1,
    id: punishment.id,
    type: punishment.punishmentType,
    issuedAt: punishment.issuedAt.getTime(),
    expirationTime: punishment.expirationTime?.getTime() ?? null,
    message: punishment.message,
    revokedAt: punishment.revokedTime?.getTime() ?? null,
    revokeMessage: punishment.revokeMessage,
    isActive: isPunishmentActive(punishment)
  }
}

export function isPunishmentActive (punishment: Punishment): boolean {
  return (punishment.expirationTime == null || punishment.expirationTime > new Date()) && punishment.revokedTime == null
}
