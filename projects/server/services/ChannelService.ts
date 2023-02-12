import { TwitchChannelInfo, YoutubeChannelInfo } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import AccountService from '@rebel/server/services/AccountService'
import ChannelStore, { TwitchChannelWithLatestInfo, UserChannel, YoutubeChannelWithLatestInfo } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import { nonNull, sortBy, values } from '@rebel/shared/util/arrays'
import { min, sum } from '@rebel/shared/util/math'
import { assertUnreachable, assertUnreachableCompile } from '@rebel/shared/util/typescript'

/** If the definition of "participation" ever changes, add more strings to this type to generate relevant compile errors. */
export const LIVESTREAM_PARTICIPATION_TYPES = 'chatParticipation' as const

export type ConnectedUserChannels = {
  /** The userId for which connected channels were requested. */
  userId: number,
  /** The aggregate user that the queried user is connected to. May be the same as `userId`. */
  aggregateUserId: number | null
  channels: UserChannel[]
}

type Deps = Dependencies<{
  chatStore: ChatStore
  channelStore: ChannelStore
  accountService: AccountService
}>

export default class ChannelService extends ContextClass {
  private readonly chatStore: ChatStore
  private readonly channelStore: ChannelStore
  private readonly accountService: AccountService

  public constructor (deps: Deps) {
    super()
    this.chatStore = deps.resolve('chatStore')
    this.channelStore = deps.resolve('channelStore')
    this.accountService = deps.resolve('accountService')
  }

  /** Returns the active user channel for each primary user. A user's active channel is the one with which the user
   * has last participated in chat. Results are unordered.
   *
   * Given that users rarely use multiple accounts at once, this is probably the most relevant
   * channel we want to associate with the user at the current time. */
  public async getActiveUserChannels (streamerId: number, primaryUserIds: number[] | null): Promise<UserChannel[]> {
    if (LIVESTREAM_PARTICIPATION_TYPES !== 'chatParticipation') {
      assertUnreachableCompile(LIVESTREAM_PARTICIPATION_TYPES)
    }

    if (primaryUserIds == null) {
      primaryUserIds = await this.accountService.getStreamerPrimaryUserIds(streamerId)
    }

    const chatMessages = await this.chatStore.getLastChatOfUsers(streamerId, primaryUserIds)
    return chatMessages.map(chat => {
      if (chat.youtubeChannel != null) {
        return {
          aggregateUserId: chat.user!.aggregateChatUserId,
          defaultUserId: chat.userId!,
          platformInfo: {
            platform: 'youtube',
            channel: chat.youtubeChannel
          }
        }
      } else if (chat.twitchChannel != null) {
        return {
          aggregateUserId: chat.user!.aggregateChatUserId,
          defaultUserId: chat.userId!,
          platformInfo: {
            platform: 'twitch',
            channel: chat.twitchChannel
          }
        }
      } else {
        throw new Error('Cannot get active channel for user because the latest chat item has no channel attached to it')
      }
    })
  }

  /** UserIds are preserved according to the `anyUserIds` parameter. */
  public async getConnectedUserChannels (anyUserIds: number[]): Promise<ConnectedUserChannels[]> {
    const allChannelIds = await this.channelStore.getConnectedUserOwnedChannels(anyUserIds)
    const youtubeChannels = await this.channelStore.getYoutubeChannelFromChannelId(allChannelIds.flatMap(id => id.youtubeChannelIds))
    const twitchChannels = await this.channelStore.getTwitchChannelFromChannelId(allChannelIds.flatMap(id => id.twitchChannelIds))

    return anyUserIds.map<ConnectedUserChannels>(userId => {
      const channelIds = allChannelIds.find(c => c.userId === userId)!

      return {
        userId: userId,
        aggregateUserId: channelIds.aggregateUserId,
        channels: [
          ...channelIds.youtubeChannelIds.map<UserChannel>(channelId => youtubeChannels.find(i => i.platformInfo.channel.id === channelId)!),
          ...channelIds.twitchChannelIds.map<UserChannel>(channelId => twitchChannels.find(i => i.platformInfo.channel.id === channelId)!)
        ]
      }
    })
  }

  /** Returns channels of the streamer whose current name matches the given name (case insensitive). */
  public async searchChannelsByName (streamerId: number, name: string): Promise<UserChannel[]> {
    if (name == null || name.length === 0) {
      return []
    }

    name = name.toLowerCase()
    const channels = await this.channelStore.getAllChannels(streamerId)
    return channels.filter(channel => getUserName(channel).toLowerCase().includes(name))
  }
}

export function getUserName (userChannel: UserChannel) {
  if (userChannel.platformInfo.platform === 'youtube') {
    return userChannel.platformInfo.channel.infoHistory[0].name
  } else if (userChannel.platformInfo.platform === 'twitch') {
    return userChannel.platformInfo.channel.infoHistory[0].displayName
  } else {
    assertUnreachable(userChannel.platformInfo)
  }
}

export function getUserNameFromChannelInfo (platform: 'youtube' | 'twitch', channelInfo: YoutubeChannelWithLatestInfo | TwitchChannelWithLatestInfo) {
  if (platform === 'youtube') {
    return (channelInfo.infoHistory[0] as YoutubeChannelInfo).name
  } else if (platform === 'twitch') {
    return (channelInfo.infoHistory[0] as TwitchChannelInfo).displayName
  } else {
    assertUnreachable(platform)
  }
}

export function getExternalIdOrUserName (userChannel: UserChannel) {
  if (userChannel.platformInfo.platform === 'youtube') {
    return userChannel.platformInfo.channel.youtubeId
  } else if (userChannel.platformInfo.platform === 'twitch') {
    return userChannel.platformInfo.channel.infoHistory[0].userName
  } else {
    assertUnreachable(userChannel.platformInfo)
  }
}
