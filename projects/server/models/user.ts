import { RegisteredUser } from '@prisma/client'
import { PublicChannel } from '@rebel/api-models/public/user/PublicChannel'
import { PublicRegisteredUser } from '@rebel/api-models/public/user/PublicRegisteredUser'
import { PublicUser } from '@rebel/api-models/public/user/PublicUser'
import { userRankToPublicObject } from '@rebel/server/models/rank'
import { getExternalIdOrUserName, getUserName } from '@rebel/server/services/ChannelService'
import { UserLevel } from '@rebel/server/services/ExperienceService'
import { UserChannel } from '@rebel/server/stores/ChannelStore'
import { UserRanks } from '@rebel/server/stores/RankStore'
import { getChannelUrlFromPublic } from '@rebel/shared/util/channel'

export type AllUserData = UserChannel & UserRanks & UserLevel & { registeredUser: RegisteredUser | null, firstSeen: number }

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
    activeRanks: data.ranks.map(userRankToPublicObject),
    firstSeen: data.firstSeen
  }
}

export function registeredUserToPublic (registeredUser: RegisteredUser | null): PublicRegisteredUser | null {
  return registeredUser == null ? null : {
    id: registeredUser.id,
    displayName: registeredUser.username
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

// terminology of method parameters:
// primaryUserId: the method will check user ids against the provided id as-is, without doing any link-checking or conversions.
//                in many cases, giving a default user when it has been linked (i.e. should have given an aggregate user) will lead to null exceptions (or otherwise incomplete or outdated data)
//                since the data for the default user would have already been linked to the aggregate user.
// anyUserId: the method will automatically handle links as required
// aggregateUserId: the method is valid only for aggregate users (it is implied that user.registeredUser != null and all of `aggregateUser`, `youtubeChannel`, and `twitchChannel` are `null`)
// defaultUserId: the method is valid only for default users (is is implied that user.registeredUser == null and any of `aggregateUser`, `youtubeChannel`, and `twitchChannel` may be non-null)

// generally speaking, only channel-related methods deal with user ids that are not primary user ids, as the output explicitly shows the links of users/channels, or implementations support linked channels being used interchangeably.
