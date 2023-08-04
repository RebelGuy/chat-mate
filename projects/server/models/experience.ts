import { RegisteredUser } from '@prisma/client'
import { PublicRankedUser } from '@rebel/api-models/public/user/PublicRankedUser'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import { channelToPublicChannel, registeredUserToPublic } from '@rebel/server/models/user'
import { RankedEntry } from '@rebel/server/services/ExperienceService'
import { CustomRankNames, UserRanks } from '@rebel/server/stores/RankStore'

export function rankedEntryToPublic (data: RankedEntry & UserRanks & CustomRankNames & { registeredUser: RegisteredUser | null, firstSeen: number }): PublicRankedUser {
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
      activeRanks: data.ranks.map(r => userRankToPublicObject(r, data.customRankNames[r.rank.name])),
      firstSeen: data.firstSeen
    }
  }
}
