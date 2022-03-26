import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import ChannelStore, { UserChannel, UserNames } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import { sortBy } from '@rebel/server/util/arrays'
import { min, sum } from '@rebel/server/util/math'

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
    const chat = await this.chatStore.getLastChatByUser(userId)

    if (chat == null) {
      return null
    } else if (chat.channel != null) {
      return {
        platform: 'youtube',
        channel: chat.channel
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
    }))

    return sortBy(matches, m => sum([...m.youtubeNames.map(n => n.length), ...m.twitchNames.map(n => n.length)]), 'asc')
  }

  public async getUserById (userId: number): Promise<UserNames | null> {
    const channelNames = await this.channelStore.getCurrentUserNames()
    return channelNames.find(userName => userName.userId === userId) ?? null
  }
}
