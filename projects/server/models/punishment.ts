import { Punishment } from '@prisma/client'
import { PublicPunishment } from '@rebel/server/controllers/public/punishment/PublicPunishment'

export function punishmentToPublicObject (punishment: Punishment): PublicPunishment {
  return {
    schema: 1,
    type: punishment.punishmentType,
    issuedAt: punishment.issuedAt.getTime(),
    expirationTime: punishment.expirationTime?.getTime() ?? null,
    message: punishment.message,
    revokedAt: punishment.revokedTime?.getTime() ?? null,
    revokeMessage: punishment.revokeMessage
  }
}
