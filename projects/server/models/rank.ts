import { Rank } from '@prisma/client'
import { PublicRank } from '@rebel/api-models/public/rank/PublicRank'
import { PublicUserRank } from '@rebel/api-models/public/rank/PublicUserRank'
import RankHelpers from '@rebel/shared/helpers/RankHelpers'
import { UserRankWithRelations } from '@rebel/server/stores/RankStore'

export function userRankToPublicObject (userRank: UserRankWithRelations, customRankName: string | null | undefined): PublicUserRank {
  return {
    rank: rankToPublicObject(userRank.rank),
    id: userRank.id,
    streamer: userRank.streamerName,
    issuedAt: userRank.issuedAt.getTime(),
    expirationTime: userRank.expirationTime?.getTime() ?? null,
    message: userRank.message,
    revokedAt: userRank.revokedTime?.getTime() ?? null,
    revokeMessage: userRank.revokeMessage,
    isActive: new RankHelpers().isRankActive(userRank), // I guess we can do this with helpers..
    customRankName: customRankName ?? null
  }
}

export function rankToPublicObject (rank: Rank): PublicRank {
  return {
    id: rank.id,
    name: rank.name,
    group: rank.group,
    displayNameNoun: rank.displayNameNoun,
    displayNameAdjective: rank.displayNameAdjective,
    description: rank.description
  }
}
