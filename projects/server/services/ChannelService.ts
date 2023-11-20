import { TwitchChannel, TwitchChannelInfo, YoutubeChannel, YoutubeChannelInfo } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import AccountService, { getPrimaryUserId } from '@rebel/server/services/AccountService'
import ChannelStore, { TwitchChannelWithLatestInfo, UserChannel, YoutubeChannelWithLatestInfo } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import { assertUnreachable, assertUnreachableCompile } from '@rebel/shared/util/typescript'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { single } from '@rebel/shared/util/arrays'
import LogService from '@rebel/server/services/LogService'

/** If the definition of "participation" ever changes, add more strings to this type to generate relevant compile errors. */
export const LIVESTREAM_PARTICIPATION_TYPES = 'chatParticipation' as const

export type ConnectedUserChannels = {
  /** The userId for which connected channels were requested. */
  userId: number,
  /** The aggregate user that the queried user is connected to. May be the same as `userId`. */
  aggregateUserId: number | null
  channels: UserChannel[]
}

export type ExternalRankEventData = {
  /** The user affected by this rank event. */
  primaryUserId: number

  /** The internal Youtube/Twitch channel id. */
  channelId: number

  /** The current ranks of type 'punishment' of the user. */
  punishmentRanksForUser: UserRankWithRelations[]

  /** The moderator that initiated this rank event. Null if unkown. */
  moderatorPrimaryUserId: number | null
}

type Deps = Dependencies<{
  chatStore: ChatStore
  channelStore: ChannelStore
  accountService: AccountService
  rankStore: RankStore
  logService: LogService
}>

export default class ChannelService extends ContextClass {
  public readonly name = ChannelService.name

  private readonly chatStore: ChatStore
  private readonly channelStore: ChannelStore
  private readonly accountService: AccountService
  private readonly rankStore: RankStore
  private readonly logService: LogService

  public constructor (deps: Deps) {
    super()
    this.chatStore = deps.resolve('chatStore')
    this.channelStore = deps.resolve('channelStore')
    this.accountService = deps.resolve('accountService')
    this.rankStore = deps.resolve('rankStore')
    this.logService = deps.resolve('logService')
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

  /** Transforms data of the rank event into the internal data types. */
  public async getTwitchDataForExternalRankEvent (streamerId: number, channelName: string, moderatorChannelName: string): Promise<ExternalRankEventData | null> {
    const channel = await this.channelStore.getChannelFromUserNameOrExternalId(channelName)
    if (channel == null || !isTwitchChannel(channel)) {
      return null
    }

    const userChannel = await this.channelStore.getTwitchChannelFromChannelId([channel.id]).then(single)
    const primaryUserId = getPrimaryUserId(userChannel)
    const channelId = userChannel.platformInfo.channel.id

    const ranks = await this.rankStore.getUserRanksForGroup('punishment', streamerId)
    const punishmentRanksForUser = ranks.filter(r => r.primaryUserId === primaryUserId)

    const moderatorChannel = await this.channelStore.getChannelFromUserNameOrExternalId(moderatorChannelName)
    const moderatorUserChannel = moderatorChannel != null && isTwitchChannel(moderatorChannel) ? await this.channelStore.getTwitchChannelFromChannelId([moderatorChannel.id]).then(single) : null
    const moderatorPrimaryUserId = moderatorUserChannel != null ? getPrimaryUserId(moderatorUserChannel) : null

    return { primaryUserId, channelId, punishmentRanksForUser, moderatorPrimaryUserId }
  }

  /** Transforms data of the rank event into the internal data types. */
  public async getYoutubeDataForExternalRankEvent (streamerId: number, channelName: string, moderatorChannelName: string): Promise<ExternalRankEventData | null> {
    const channels = await this.searchChannelsByName(streamerId, channelName)
    if (channels.length !== 1) {
      return null
    }

    const channel = single(channels)
    const primaryUserId = getPrimaryUserId(channel)
    const channelId = channel.platformInfo.channel.id

    const ranks = await this.rankStore.getUserRanksForGroup('punishment', streamerId)
    const punishmentRanksForUser = ranks.filter(r => r.primaryUserId === primaryUserId)

    // we can search a bit more intelligently for moderator channels by reducing the pool of potential matches to actual moderators instead of all users
    const administrationUserRanks = await this.rankStore.getUserRanksForGroup('administration', streamerId)
    const modPrimaryUserIds = administrationUserRanks.filter(ur => ur.rank.name === 'mod' || ur.rank.name === 'owner').map(ur => ur.primaryUserId)
    const matchingChannelsForModerator = await this.searchChannelsByName(streamerId, moderatorChannelName)
    const moderatorChannels = matchingChannelsForModerator.filter(c => modPrimaryUserIds.includes(getPrimaryUserId(c)))
    if (moderatorChannels.length !== 1) {
      this.logService.logInfo(this, `Searched for moderator channel '${channelName}' for streamer ${streamerId} but found ${moderatorChannels.length} matches.`)
    }

    const moderatorChannel = moderatorChannels.length === 1 ? single(moderatorChannels) : null
    const moderatorPrimaryUserId = moderatorChannel != null ? getPrimaryUserId(moderatorChannel) : null

    return { primaryUserId, channelId, punishmentRanksForUser, moderatorPrimaryUserId }
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

export function isYoutubeChannel (channel: YoutubeChannel | TwitchChannel): channel is YoutubeChannel {
  return 'youtubeId' in channel
}

export function isTwitchChannel (channel: YoutubeChannel | TwitchChannel): channel is TwitchChannel {
  return 'twitchId' in channel
}
