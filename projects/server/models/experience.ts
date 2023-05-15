import { RegisteredUser } from '@prisma/client'
import { PublicRankedUser } from '@rebel/server/controllers/public/user/PublicRankedUser'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import { channelToPublicChannel, registeredUserToPublic } from '@rebel/server/models/user'
import { RankedEntry } from '@rebel/server/services/ExperienceService'
import { UserRanks } from '@rebel/server/stores/RankStore'

export function rankedEntryToPublic (data: RankedEntry & UserRanks & { registeredUser: RegisteredUser | null, firstSeen: number }): PublicRankedUser {
  return {
    rank: data.rank,
    user: {
      primaryUserId: data.primaryUserId,
      registeredUser: registeredUserToPublic(data.registeredUser),
      channel: channelToPublicChannel(data.channel),
      levelInfo: {
        level: data.level,
        levelProgress: data.levelProgress
      },
      activeRanks: data.ranks.map(userRankToPublicObject),
      firstSeen: data.firstSeen
    }
  }
}
