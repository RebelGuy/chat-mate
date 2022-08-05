import { PublicUserRank } from '@rebel/server/controllers/public/rank/PublicUserRank'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { PublicUserNames } from '@rebel/server/controllers/public/user/PublicUserNames'
import { getUserName } from '@rebel/server/services/ChannelService'
import { UserLevel } from '@rebel/server/services/ExperienceService'
import { UserChannel, UserNames } from '@rebel/server/stores/ChannelStore'

export function userChannelAndLevelToPublicUser (data: UserChannel & UserLevel, activeRanks: PublicUserRank[]): PublicUser {
  return {
    schema: 3,
    id: data.channel.userId,
    userInfo: {
      schema: 1,
      channelName: getUserName(data)
    },
    levelInfo: {
      schema: 1,
      level: data.level.level,
      levelProgress: data.level.levelProgress
    },
    activeRanks: activeRanks
  }
}

export function userNamesAndLevelToPublicUserNames (data: UserNames & UserChannel & UserLevel, activeRanks: PublicUserRank[]): PublicUserNames {
  return {
    schema: 3,
    user: userChannelAndLevelToPublicUser(data, activeRanks),
    youtubeChannelNames: data.youtubeNames,
    twitchChannelNames: data.twitchNames,
  }
}
