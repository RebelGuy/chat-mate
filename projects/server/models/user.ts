import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { Level } from '@rebel/server/services/ExperienceService'
import { ChannelName, ChannelWithLatestInfo } from '@rebel/server/stores/ChannelStore'

export function userAndLevelToPublicUser (data: ChannelName & Level): PublicUser {
  return {
    schema: 1,
    id: data.id,
    userInfo: {
      schema: 1,
      channelName: data.name
    },
    levelInfo: {
      schema: 1,
      level: data.level,
      levelProgress: data.levelProgress
    }
  }
}

export function channelInfoAndLevelToPublicUser (data: ChannelWithLatestInfo & Level): PublicUser {
  return {
    schema: 1,
    id: data.id,
    userInfo: {
      schema: 1,
      channelName: data.infoHistory[0].name
    },
    levelInfo: {
      schema: 1,
      level: data.level,
      levelProgress: data.levelProgress
    }
  }
}
