import { Rank } from '@prisma/client'
import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import { PublicUserRank } from '@rebel/server/controllers/public/rank/PublicUserRank'
import RankHelpers from '@rebel/server/helpers/RankHelpers'
import { UserRankWithRelations } from '@rebel/server/stores/RankStore'

export function userRankToPublicObject (userRank: UserRankWithRelations): PublicUserRank {
  return {
    schema: 1,
    rank: rankToPublicObject(userRank.rank),
    id: userRank.id,
    streamer: userRank.streamerName,
    issuedAt: userRank.issuedAt.getTime(),
    expirationTime: userRank.expirationTime?.getTime() ?? null,
    message: userRank.message,
    revokedAt: userRank.revokedTime?.getTime() ?? null,
    revokeMessage: userRank.revokeMessage,
    isActive: new RankHelpers().isRankActive(userRank) // I guess we can do this with helpers..
  }
}

export function rankToPublicObject (rank: Rank): PublicRank {
  return {
    schema: 1,
    id: rank.id,
    name: rank.name,
    group: rank.group,
    displayNameNoun: rank.displayNameNoun,
    displayNameAdjective: rank.displayNameAdjective,
    description: rank.description
  }
}
