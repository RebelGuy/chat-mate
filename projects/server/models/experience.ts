import { PublicPunishment } from '@rebel/server/controllers/public/punishment/PublicPunishment'
import { PublicRankedUser } from '@rebel/server/controllers/public/user/PublicRankedUser'
import { RankedEntry } from '@rebel/server/services/ExperienceService'

export function rankedEntryToPublic (rankedEntry: RankedEntry, activePunishments: PublicPunishment[]): PublicRankedUser {
  return {
    schema: 2,
    rank: rankedEntry.rank,
    user: {
      schema: 2,
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
      activePunishments: activePunishments
    }
  }
}
