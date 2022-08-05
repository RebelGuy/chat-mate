import { PublicUserRank } from '@rebel/server/controllers/public/rank/PublicUserRank'
import { PublicRankedUser } from '@rebel/server/controllers/public/user/PublicRankedUser'
import { RankedEntry } from '@rebel/server/services/ExperienceService'

export function rankedEntryToPublic (rankedEntry: RankedEntry, activeRanks: PublicUserRank[]): PublicRankedUser {
  return {
    schema: 3,
    rank: rankedEntry.rank,
    user: {
      schema: 3,
      id: rankedEntry.userId,
      userInfo: {
        schema: 1,
        channelName: rankedEntry.userName
      },
      levelInfo: {
        schema: 1,
        level: rankedEntry.level,
        levelProgress: rankedEntry.levelProgress
      },
      activeRanks: activeRanks
    }
  }
}
