import { PublicPunishment } from '@rebel/server/controllers/public/punishment/PublicPunishment'
import { isRankActive } from '@rebel/server/models/rank'
import { UserRankWithRelations } from '@rebel/server/stores/RankStore'

export function punishmentToPublicObject (punishment: UserRankWithRelations): PublicPunishment {
  if (punishment.rank.name !== 'banned' && punishment.rank.name !== 'muted' && punishment.rank.name !== 'timed_out') {
    throw new Error('Invalid punishment rank name: ' + punishment.rank.name)
  }

  return {
    schema: 2,
    id: punishment.id,
    type: punishment.rank.name,
    issuedAt: punishment.issuedAt.getTime(),
    expirationTime: punishment.expirationTime?.getTime() ?? null,
    message: punishment.message,
    revokedAt: punishment.revokedTime?.getTime() ?? null,
    revokeMessage: punishment.revokeMessage,
    isActive: isRankActive(punishment)
  }
}
