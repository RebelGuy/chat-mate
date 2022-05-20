import { PublicPunishment } from '@rebel/server/controllers/public/punishment/PublicPunishment'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { PublicUserNames } from '@rebel/server/controllers/public/user/PublicUserNames'
import { getUserName } from '@rebel/server/services/ChannelService'
import { Level } from '@rebel/server/services/ExperienceService'
import { UserChannel, UserNames } from '@rebel/server/stores/ChannelStore'

export function userChannelAndLevelToPublicUser (data: UserChannel & Level, activePunishments: PublicPunishment[]): PublicUser {
  return {
    schema: 2,
    id: data.channel.userId,
    userInfo: {
      schema: 1,
      channelName: getUserName(data)
    },
    levelInfo: {
      schema: 1,
      level: data.level,
      levelProgress: data.levelProgress
    },
    activePunishments: activePunishments
  }
}

export function userNamesAndLevelToPublicUserNames (data: UserNames & Level): PublicUserNames {
  return {
    schema: 1,
    id: data.userId,
    youtubeChannelNames: data.youtubeNames,
    twitchChannelNames: data.twitchNames,
    levelInfo: {
      schema: 1,
      level: data.level,
      levelProgress: data.levelProgress
    }
  }
}
