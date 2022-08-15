import { PublicRankedUser } from '@rebel/server/controllers/public/user/PublicRankedUser'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import { RankedEntry } from '@rebel/server/services/ExperienceService'
import { UserRanks } from '@rebel/server/stores/RankStore'

export function rankedEntryToPublic (data: RankedEntry & UserRanks): PublicRankedUser {
  return {
    schema: 3,
    rank: data.rank,
    user: {
      schema: 3,
      id: data.userId,
      userInfo: {
        schema: 1,
        channelName: data.userName
      },
      levelInfo: {
        schema: 1,
        level: data.level,
        levelProgress: data.levelProgress
      },
      activeRanks: data.ranks.map(userRankToPublicObject)
    }
  }
}
