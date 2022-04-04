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

  /** Gets the user's channel with the most recent activity. Given that users rarely use multiple accounts at once,
   * this is probably the most relevant channel we want to associate with the user at the current time. */
  public async getActiveUserChannel (userId: number): Promise<UserChannel | null> {
    if (LIVESTREAM_PARTICIPATION_TYPES !== 'chatParticipation') {
      assertUnreachableCompile(LIVESTREAM_PARTICIPATION_TYPES)
    }

    const chat = await this.chatStore.getLastChatByUser(userId)

    if (chat == null) {
      return null
    } else if (chat.youtubeChannel != null) {
      return {
        platform: 'youtube',
        channel: chat.youtubeChannel
      }
    } else if (chat.twitchChannel != null) {
      return {
        platform: 'twitch',
        channel: chat.twitchChannel
      }
    } else {
      throw new Error('Cannot get active channel for user because the latest chat item has no channel attached to it')
    }
  }

  /** Returns all active user channels. */
  public async getActiveUserChannels (): Promise<UserChannel[]> {
    const allIds = await this.channelStore.getCurrentUserIds()
    const userChannels = await Promise.all(allIds.map(id => this.getActiveUserChannel(id)))
    return nonNull(userChannels)
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
  if (userChannel.platform === 'youtube') {
    return userChannel.channel.infoHistory[0].name
  } else if (userChannel.platform === 'twitch') {
    return userChannel.channel.infoHistory[0].displayName
  } else {
    assertUnreachable(userChannel)
  }
}
