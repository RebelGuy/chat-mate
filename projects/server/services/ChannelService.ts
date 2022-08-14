import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import ChannelStore, { UserChannel, UserNames } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import { nonNull, sortBy } from '@rebel/server/util/arrays'
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
   * has last participated in chat. It is null if the user has not yet participated in chat.
   * 
   * Given that users rarely use multiple accounts at once, this is probably the most relevant
   * channel we want to associate with the user at the current time. */
  public async getActiveUserChannels (userIds: number[] | 'all'): Promise<UserChannel[]> {
    if (LIVESTREAM_PARTICIPATION_TYPES !== 'chatParticipation') {
      assertUnreachableCompile(LIVESTREAM_PARTICIPATION_TYPES)
    }

    const chatMessages = await this.chatStore.getLastChatOfUsers(userIds)

    return chatMessages.map(chat => {
      if (chat.youtubeChannel != null) {
        return {
          userId: chat.userId,
          platformInfo: {
            platform: 'youtube',
            channel: chat.youtubeChannel
          }
        }
      } else if (chat.twitchChannel != null) {
        return {
          userId: chat.userId,
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
