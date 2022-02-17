import { PublicRankedUser } from '@rebel/server/controllers/public/user/PublicRankedUser'
import { RankedEntry } from '@rebel/server/services/ExperienceService'

export function rankedEntryToPublic (rankedEntry: RankedEntry): PublicRankedUser {
  return {
    schema: 1,
    rank: rankedEntry.rank,
    user: {
      schema: 1,
      id: rankedEntry.channelId,
      userInfo: {
        schema: 1,
        channelName: rankedEntry.channelName
      },
      levelInfo: {
        schema: 1,
        level: rankedEntry.level,
        levelProgress: rankedEntry.levelProgress
      }
    }
  }
}
