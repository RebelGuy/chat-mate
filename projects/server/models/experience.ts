import { RegisteredUser } from '@prisma/client'
import { PublicRankedUser } from '@rebel/server/controllers/public/user/PublicRankedUser'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import { registeredUserToPublic } from '@rebel/server/models/user'
import { getExternalIdOrUserName, getUserName } from '@rebel/server/services/ChannelService'
import { RankedEntry } from '@rebel/server/services/ExperienceService'
import { UserRanks } from '@rebel/server/stores/RankStore'

export function rankedEntryToPublic (data: RankedEntry & UserRanks & { registeredUser: RegisteredUser | null }): PublicRankedUser {
  return {
    rank: data.rank,
    user: {
      primaryUserId: data.primaryUserId,
      registeredUser: registeredUserToPublic(data.registeredUser),
      channelInfo: {
        defaultUserId: data.channel.defaultUserId,
        channelName: getUserName(data.channel),
        externalIdOrUserName: getExternalIdOrUserName(data.channel),
        platform: data.channel.platformInfo.platform
      },
      levelInfo: {
        level: data.level,
        levelProgress: data.levelProgress
      },
      activeRanks: data.ranks.map(userRankToPublicObject)
    }
  }
}
