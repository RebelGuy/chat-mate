import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { PublicUserNames } from '@rebel/server/controllers/public/user/PublicUserNames'
import { getUserName } from '@rebel/server/services/ChannelService'
import { Level } from '@rebel/server/services/ExperienceService'
import { UserChannel, UserNames } from '@rebel/server/stores/ChannelStore'

export function userChannelAndLevelToPublicUser (data: UserChannel & Level): PublicUser {
  return {
    schema: 1,
    id: data.channel.userId,
    userInfo: {
      schema: 1,
      channelName: getUserName(data)
    },
    levelInfo: {
      schema: 1,
      level: data.level,
      levelProgress: data.levelProgress
    }
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
