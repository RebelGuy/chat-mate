import { Rank } from '@prisma/client'
import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import { PublicUserRank } from '@rebel/server/controllers/public/rank/PublicUserRank'
import { UserRankWithRelations } from '@rebel/server/stores/RankStore'

export function userRankToPublicObject (userRank: UserRankWithRelations): PublicUserRank {
  return {
    schema: 1,
    rank: rankToPublicObject(userRank.rank),
    id: userRank.id,
    issuedAt: userRank.issuedAt.getTime(),
    expirationTime: userRank.expirationTime?.getTime() ?? null,
    message: userRank.message,
    revokedAt: userRank.revokedTime?.getTime() ?? null,
    revokeMessage: userRank.revokeMessage,
    isActive: isRankActive(userRank)
  }
}

export function rankToPublicObject (rank: Rank): PublicRank {
  return {
    schema: 1,
    name: rank.name,
    group: rank.group,
    displayNameNoun: rank.displayNameNoun,
    displayNameAdjective: rank.displayNameAdjective,
    description: rank.description
  }
}

export function isRankActive (rank: UserRankWithRelations): boolean {
  return (rank.expirationTime == null || rank.expirationTime > new Date()) && rank.revokedTime == null
}