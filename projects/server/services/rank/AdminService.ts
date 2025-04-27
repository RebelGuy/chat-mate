import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import RankStore from '@rebel/server/stores/RankStore'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import { getUserName, isYoutubeChannel } from '@rebel/server/services/ChannelService'
import { single } from '@rebel/shared/util/arrays'
import { ChatMateError } from '@rebel/shared/util/error'

type Deps = Dependencies<{
  twitchUsername: string
  rankStore: RankStore
  channelId: string
  channelStore: ChannelStore
}>

export default class AdminService extends ContextClass {
  public readonly name = AdminService.name

  private readonly twitchUsername: string
  private readonly youtubeChannelId: string
  private readonly rankStore: RankStore
  private readonly channelStore: ChannelStore

  constructor (deps: Deps) {
    super()

    this.twitchUsername = deps.resolve('twitchUsername')
    this.rankStore = deps.resolve('rankStore')
    this.youtubeChannelId = deps.resolve('channelId')
    this.channelStore = deps.resolve('channelStore')
  }

  /** Returns all current system admin users. */
  public async getAdminUsers (streamerId: number): Promise<{ chatUserId: number}[]> {
    const allRanks = await this.rankStore.getUserRanksForGroup('administration', streamerId)
    return allRanks.filter(r => r.rank.name === 'admin').map(r => ({ chatUserId: r.primaryUserId }))
  }

  /** The username of the ChatMate Twitch account. */
  public getTwitchUsername (): string {
    return this.twitchUsername
  }

  public async getYoutubeChannelName (): Promise<string> {
    const channel = await this.channelStore.getChannelFromUserNameOrExternalId(this.youtubeChannelId)
    if (channel == null || !isYoutubeChannel(channel)) {
      throw new ChatMateError('Admin Youtube channel not found')
    }

    const userChannel = await this.channelStore.getYoutubeChannelsFromChannelIds([channel.id]).then(single)
    return getUserName(userChannel)
  }
}
