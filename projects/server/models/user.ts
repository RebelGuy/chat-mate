import { RegisteredUser } from '@prisma/client'
import { PublicChannel } from '@rebel/api-models/public/user/PublicChannel'
import { PublicRegisteredUser } from '@rebel/api-models/public/user/PublicRegisteredUser'
import { PublicUser } from '@rebel/api-models/public/user/PublicUser'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import { getExternalIdOrUserName, getUserName } from '@rebel/server/services/ChannelService'
import { UserLevel } from '@rebel/server/services/ExperienceService'
import { UserChannel } from '@rebel/server/stores/ChannelStore'
import { CustomRankNames, UserRanks } from '@rebel/server/stores/RankStore'
import { getChannelUrlFromPublic } from '@rebel/shared/util/channel'

export type AllUserData = UserChannel & UserRanks & UserLevel & CustomRankNames & { registeredUser: RegisteredUser | null, firstSeen: number }

/** It is expected that the data is for the primary user, thus `userId` is the `primaryUserId`. */
export function userDataToPublicUser (data: AllUserData): PublicUser {
  return {
    primaryUserId: data.primaryUserId,
    registeredUser: registeredUserToPublic(data.registeredUser),
    channel: channelToPublicChannel(data),
    levelInfo: {
      level: data.level.level,
      levelProgress: data.level.levelProgress
    },
    activeRanks: data.ranks.map(r => userRankToPublicObject(r, data.customRankNames[r.rank.name])),
    firstSeen: data.firstSeen
  }
}

export function registeredUserToPublic (registeredUser: RegisteredUser | null): PublicRegisteredUser | null {
  return registeredUser == null ? null : {
    id: registeredUser.id,
    username: registeredUser.username,
    displayName: registeredUser.displayName
  }
}

export function channelToPublicChannel (channel: UserChannel): PublicChannel {
  return {
    channelId: channel.platformInfo.channel.id,
    defaultUserId: channel.defaultUserId,
    displayName: getUserName(channel),
    externalIdOrUserName: getExternalIdOrUserName(channel),
    platform: channel.platformInfo.platform,
    channelUrl: getChannelUrl(channel)
  }
}

function getChannelUrl (channel: UserChannel) {
  const id = getExternalIdOrUserName(channel)
  return getChannelUrlFromPublic({ externalIdOrUserName: id, platform: channel.platformInfo.platform })
}
