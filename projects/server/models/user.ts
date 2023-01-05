import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { PublicUserNames } from '@rebel/server/controllers/public/user/PublicUserNames'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import { getExternalIdOrUserName, getUserName } from '@rebel/server/services/ChannelService'
import { UserLevel } from '@rebel/server/services/ExperienceService'
import { UserChannel, UserNames } from '@rebel/server/stores/ChannelStore'
import { UserRanks } from '@rebel/server/stores/RankStore'

export function userDataToPublicUser (data: UserChannel & UserLevel & UserRanks): PublicUser {
  return {
    schema: 3,
    id: data.userId,
    userInfo: {
      schema: 1,
      channelName: getUserName(data),
      externalIdOrUserName: getExternalIdOrUserName(data),
      platform: data.platformInfo.platform
    },
    levelInfo: {
      schema: 1,
      level: data.level.level,
      levelProgress: data.level.levelProgress
    },
    activeRanks: data.ranks.map(userRankToPublicObject)
  }
}

export function userDataToPublicUserNames (data: UserNames & UserChannel & UserLevel & UserRanks): PublicUserNames {
  return {
    schema: 3,
    user: userDataToPublicUser(data),
    youtubeChannelNames: data.youtubeNames,
    twitchChannelNames: data.twitchNames,
  }
}
