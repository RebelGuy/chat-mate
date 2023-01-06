import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import ChannelStore, { UserChannel, UserNames } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import { nonNull, sortBy, values } from '@rebel/server/util/arrays'
import { min, sum } from '@rebel/server/util/math'
import { assertUnreachable, assertUnreachableCompile } from '@rebel/server/util/typescript'

/** If the definition of "participation" ever changes, add more strings to this type to generate relevant compile errors. */
export const LIVESTREAM_PARTICIPATION_TYPES = 'chatParticipation' as const

type Deps = Dependencies<{
  chatStore: ChatStore
  channelStore: ChannelStore
}>

export default class ChannelService extends ContextClass {
  private readonly chatStore: ChatStore
  private readonly channelStore: ChannelStore

  public constructor (deps: Deps) {
    super()
    this.chatStore = deps.resolve('chatStore')
    this.channelStore = deps.resolve('channelStore')
  }

  /** Returns active user channels for each user. A user's active channel is the one with which the user
   * has last participated in chat. The entry of users who have not yet participated in chat are ommitted,
   * and results are not necessarily ordered.
   *
   * If a userId is a default ID, any connected channels are ignored. If a userId is an aggregate ID, only the most recent
   * chat item of any of its connected users will be returned, but **rewired so that the chat item's user is the aggregate user**.
   *
   * If getting all users, aggregate users will be ignored completely.
   *
   * Given that users rarely use multiple accounts at once, this is probably the most relevant
   * channel we want to associate with the user at the current time. */
  public async getActiveUserChannels (streamerId: number, anyUserIds: number[] | 'all'): Promise<UserChannel[]> {
    if (LIVESTREAM_PARTICIPATION_TYPES !== 'chatParticipation') {
      assertUnreachableCompile(LIVESTREAM_PARTICIPATION_TYPES)
    }

    const chatMessages = await this.chatStore.getLastChatOfUsers(streamerId, anyUserIds)

    const relevantChatItems = new Map<number, ChatItemWithRelations>()
    for (const chat of sortBy(chatMessages, c => c.time.getTime(), 'desc')) {
      if (chat.user == null) {
        throw new Error('UserId of Youtube/Twitch chat messages was expected to be set')
      }

      // due to the ordering, we only need to check whether a chat message for a user
      // already exists in the set - if it does, we know it's the most recent one.

      // save the chat mesage against the default user, if we are interested in this user
      const defaultUserId = chat.userId!
      if ((anyUserIds === 'all' || anyUserIds.includes(defaultUserId)) && !relevantChatItems.has(defaultUserId)) {
        relevantChatItems.set(defaultUserId, chat)
      }

      if (anyUserIds === 'all') {
        continue
      }

      // save the chat message against the aggregate user, if we are interested in this user
      const aggregateUserId = chat.user!.aggregateChatUserId
      if (aggregateUserId != null && anyUserIds.includes(aggregateUserId) && !relevantChatItems.has(aggregateUserId)) {
        const aggregateUser = { ...chat.user!.aggregateChatUser!, aggregateChatUserId: null, aggregateChatUser: null }
        relevantChatItems.set(aggregateUserId, { ...chat, userId: aggregateUserId, user: aggregateUser })
      }
    }

    return values(relevantChatItems).map<UserChannel>(chat => {
      if (chat.youtubeChannel != null) {
        return {
          userId: chat.userId!,
          platformInfo: {
            platform: 'youtube',
            channel: chat.youtubeChannel
          }
        }
      } else if (chat.twitchChannel != null) {
        return {
          userId: chat.userId!,
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

  public async getConnectedUserChannels (anyUserId: number): Promise<UserChannel[]> {
    const channelIds = await this.channelStore.getConnectedUserOwnedChannels(anyUserId)

    // ??????
    const channels: UserChannel[] = await Promise.all([
      ...channelIds.youtubeChannels.map(c => this.channelStore.getYoutubeChannelFromChannelId(c).then(channel => ({
        userId: channel.userId,
        platformInfo: {
          platform: 'youtube' as const,
          channel: channel
        }
      }))),
      ...channelIds.twitchChannels.map(c => this.channelStore.getTwitchChannelFromChannelId(c).then(channel => ({
        userId: channel.userId,
        platformInfo: {
          platform: 'twitch' as const,
          channel: channel
        }
      })))
    ])

    return channels
  }

  /** Returns channels matching the given name, sorted in ascending order of channel name length (i.e. best sequential match is first). */
  public async getUserByChannelName (name: string): Promise<UserNames[]> {
    if (name == null || name.length === 0) {
      return []
    }

    const userNames = await this.channelStore.getCurrentUserNames()

    name = name.toLowerCase()
    const matches = userNames.map(user => ({
      userId: user.userId,
      youtubeNames: user.youtubeNames.filter(n => n.toLowerCase().includes(name)),
      twitchNames: user.twitchNames.filter(n => n.toLowerCase().includes(name))
    })).filter(user => user.youtubeNames.length > 0 || user.twitchNames.length > 0)

    return sortBy(matches, m => sum([...m.youtubeNames.map(n => n.length), ...m.twitchNames.map(n => n.length)]), 'asc')
  }

  public async getUserById (userId: number): Promise<UserNames | null> {
    const channelNames = await this.channelStore.getCurrentUserNames()
    return channelNames.find(userName => userName.userId === userId) ?? null
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

export function getExternalIdOrUserName (userChannel: UserChannel) {
  if (userChannel.platformInfo.platform === 'youtube') {
    return userChannel.platformInfo.channel.youtubeId
  } else if (userChannel.platformInfo.platform === 'twitch') {
    return userChannel.platformInfo.channel.infoHistory[0].userName
  } else {
    assertUnreachable(userChannel.platformInfo)
  }
}
