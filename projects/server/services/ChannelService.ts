import { YoutubeChannelGlobalInfo, TwitchChannelGlobalInfo, TwitchChannel, YoutubeChannel, YoutubeChannelStreamerInfo, TwitchChannelStreamerInfo } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import AccountService from '@rebel/server/services/AccountService'
import ChannelStore, { CreateOrUpdateGlobalTwitchChannelArgs, CreateOrUpdateGlobalYoutubeChannelArgs, CreateOrUpdateStreamerTwitchChannelArgs, CreateOrUpdateStreamerYoutubeChannelArgs, CreateOrUpdateTwitchChannelArgs, CreateOrUpdateYoutubeChannelArgs, TwitchChannelWithLatestInfo, UserChannel, YoutubeChannelWithLatestInfo, getYoutubeChannelImageFingerprint } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import { assertUnreachable, assertUnreachableCompile, compare } from '@rebel/shared/util/typescript'
import { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { ChatMateError } from '@rebel/shared/util/error'
import ImageService, { ImageInfo } from '@rebel/server/services/ImageService'
import ImageStore from '@rebel/server/stores/ImageStore'
import S3ProxyService from '@rebel/server/services/S3ProxyService'
import LogService from '@rebel/server/services/LogService'
import { ObjectComparator, SafeOmit } from '@rebel/shared/types'
import { ChatPlatform } from '@rebel/server/models/chat'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'

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

  /** The current ranks of the specified group of the user. */
  ranksForUser: UserRankWithRelations[]

  /** The moderator that initiated this rank event. Null if unknown. */
  moderatorPrimaryUserId: number | null
}

type Deps = Dependencies<{
  chatStore: ChatStore
  channelStore: ChannelStore
  accountService: AccountService
  imageService: ImageService
  imageStore: ImageStore
  s3ProxyService: S3ProxyService
  logService: LogService
  chatMateStateService: ChatMateStateService
}>

export default class ChannelService extends ContextClass {
  public readonly name = ChannelService.name

  private readonly chatStore: ChatStore
  private readonly channelStore: ChannelStore
  private readonly accountService: AccountService
  private readonly imageService: ImageService
  private readonly imageStore: ImageStore
  private readonly s3ProxyService: S3ProxyService
  private readonly logService: LogService
  private readonly chatMateStateService: ChatMateStateService

  public constructor (deps: Deps) {
    super()
    this.chatStore = deps.resolve('chatStore')
    this.channelStore = deps.resolve('channelStore')
    this.accountService = deps.resolve('accountService')
    this.imageService = deps.resolve('imageService')
    this.imageStore = deps.resolve('imageStore')
    this.s3ProxyService = deps.resolve('s3ProxyService')
    this.logService = deps.resolve('logService')
    this.chatMateStateService = deps.resolve('chatMateStateService')
  }

  public async createOrUpdateYoutubeChannel (externalId: string, channelInfo: CreateOrUpdateYoutubeChannelArgs): Promise<YoutubeChannelWithLatestInfo> {
    const semaphore = this.chatMateStateService.getChannelSemaphore()
    await semaphore.enter(externalId)

    try {
      let currentChannel = await this.channelStore.tryGetYoutubeChannelWithLatestInfo(externalId)
      if (currentChannel == null) {
        return await this.channelStore.createYoutubeChannel(externalId, channelInfo, (channelId, channelGlobalInfoId) => this.onGetImageInfo(channelInfo.imageUrl, channelId, channelGlobalInfoId))
      }

      // check if anything has changed - if so, update info
      const storedGlobalInfo = currentChannel?.globalInfoHistory[0]
      const storedImage = await this.imageStore.getImageByFingerprint(getYoutubeChannelImageFingerprint(channelInfo.imageUrl))
      if (storedImage == null || globalChannelInfoHasChanged('youtube', storedGlobalInfo, channelInfo)) {
        this.logService.logInfo(this, `Global info for youtube channel ${currentChannel.id} has changed and will be updated`)
        currentChannel = await this.channelStore.updateYoutubeChannel_Global(
          externalId,
          channelInfo,
          storedImage?.id ?? storedGlobalInfo.imageId,
          storedImage == null ? (channelId, channelGlobalInfoId) => this.onGetImageInfo(channelInfo.imageUrl, channelId, channelGlobalInfoId) : null
        )
      }

      const storedStreamerInfo: YoutubeChannelStreamerInfo | null = await this.channelStore.getYoutubeChannelHistoryForStreamer(channelInfo.streamerId, currentChannel.id, 1).then(history => history[0])
      if (storedStreamerInfo == null || streamerChannelInfoHasChanged('youtube', storedStreamerInfo, channelInfo)) {
        this.logService.logInfo(this, `Streamer info for youtube channel ${currentChannel.id} (streamer ${channelInfo.streamerId}) has changed and will be updated`)
        await this.channelStore.updateYoutubeChannel_Streamer(externalId, channelInfo)
      }

      return currentChannel
    } finally {
      semaphore.exit(externalId)
    }
  }

  public async createOrUpdateTwitchChannel (externalId: string, channelInfo: CreateOrUpdateTwitchChannelArgs): Promise<TwitchChannelWithLatestInfo> {
    const semaphore = this.chatMateStateService.getChannelSemaphore()
    await semaphore.enter(externalId)

    try {
      let currentChannel = await this.channelStore.tryGetTwitchChannelWithLatestInfo(externalId)
      if (currentChannel == null) {
        return await this.channelStore.createTwitchChannel(externalId, channelInfo)
      }

      // check if anything has changed - if so, update info
      const storedGlobalInfo = currentChannel.globalInfoHistory[0]
      if (globalChannelInfoHasChanged('twitch', storedGlobalInfo, channelInfo)) {
        this.logService.logInfo(this, `Global info for twitch channel ${currentChannel.id} has changed and will be updated`)
        currentChannel = await this.channelStore.updateTwitchChannel_Global(externalId, channelInfo)
      }

      const storedStreamerInfo: TwitchChannelStreamerInfo | null = await this.channelStore.getTwitchChannelHistoryForStreamer(channelInfo.streamerId, currentChannel.id, 1).then(history => history[0])
      if (storedStreamerInfo == null || streamerChannelInfoHasChanged('twitch', storedStreamerInfo, channelInfo)) {
        this.logService.logInfo(this, `Streamer info for twitch channel ${currentChannel.id} (streamer ${channelInfo.streamerId}) has changed and will be updated`)
        await this.channelStore.updateTwitchChannel_Streamer(externalId, channelInfo)
      }

      return currentChannel
    } finally {
      semaphore.exit(externalId)
    }
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
        throw new ChatMateError('Cannot get active channel for user because the latest chat item has no channel attached to it')
      }
    })
  }

  /** UserIds are preserved according to the `anyUserIds` parameter. */
  public async getConnectedUserChannels (anyUserIds: number[]): Promise<ConnectedUserChannels[]> {
    const allChannelIds = await this.channelStore.getConnectedUserOwnedChannels(anyUserIds)
    const youtubeChannels = await this.channelStore.getYoutubeChannelsFromChannelIds(allChannelIds.flatMap(id => id.youtubeChannelIds))
    const twitchChannels = await this.channelStore.getTwitchChannelsFromChannelIds(allChannelIds.flatMap(id => id.twitchChannelIds))

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

  private async onGetImageInfo (originalImageUrl: string, channelId: number, channelGlobalInfoId: number): Promise<ImageInfo> {
    const url = this.upsizeYoutubeImage(originalImageUrl)
    const imageData = await this.imageService.convertToPng(url, 'questionMark')
    const fileName = getChannelFileUrl(channelId, channelGlobalInfoId)
    await this.s3ProxyService.uploadBase64Image(fileName, 'png', false, imageData)
    const relativeUrl = this.s3ProxyService.constructRelativeUrl(fileName)
    const dimensions = this.imageService.getImageDimensions(imageData)
    return {
      relativeImageUrl: relativeUrl,
      imageWidth: dimensions.width,
      imageHeight: dimensions.height
    }
  }

  private upsizeYoutubeImage (originalUrl: string) {
    // all images seem to conform to the format `...=s64-...`, where 64 represents the image size in pixels.
    // turns out we can increase this size - if the underlying photo is smaller, youtube will just upscale the image;
    // otherwise, we get back a better quality image.
    const sizeStartIndex = originalUrl.indexOf('=s64-')
    if (sizeStartIndex < 0) {
      this.logService.logError(this, 'Could not find sizing information in the original URL:', originalUrl)
      return originalUrl
    }

    return originalUrl.replace('=s64-', '=s1024-')
  }
}

export function getUserName (userChannel: UserChannel) {
  if (userChannel.platformInfo.platform === 'youtube') {
    return userChannel.platformInfo.channel.globalInfoHistory[0].name
  } else if (userChannel.platformInfo.platform === 'twitch') {
    return userChannel.platformInfo.channel.globalInfoHistory[0].displayName
  } else {
    assertUnreachable(userChannel.platformInfo)
  }
}

export function getUserNameFromChannelInfo (platform: 'youtube' | 'twitch', channelInfo: YoutubeChannelWithLatestInfo | TwitchChannelWithLatestInfo) {
  if (platform === 'youtube') {
    return (channelInfo.globalInfoHistory[0] as YoutubeChannelGlobalInfo).name
  } else if (platform === 'twitch') {
    return (channelInfo.globalInfoHistory[0] as TwitchChannelGlobalInfo).displayName
  } else {
    assertUnreachable(platform)
  }
}

export function getExternalIdOrUserName (userChannel: UserChannel) {
  if (userChannel.platformInfo.platform === 'youtube') {
    return userChannel.platformInfo.channel.youtubeId
  } else if (userChannel.platformInfo.platform === 'twitch') {
    return userChannel.platformInfo.channel.globalInfoHistory[0].userName
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

function getChannelFileUrl (internalYoutubeChannelId: number, youtubeGlobalChannelInfoId: number) {
  return `channel/youtube/${internalYoutubeChannelId}/${youtubeGlobalChannelInfoId}.png`
}

const youtubeChannelGlobalInfoComparator: ObjectComparator<SafeOmit<CreateOrUpdateGlobalYoutubeChannelArgs, 'imageId'>> = {
  imageUrl: 'default',
  name: 'default',
  time: null,
  isVerified: 'default'
}
const youtubeChannelStreamerInfoComparator: ObjectComparator<CreateOrUpdateStreamerYoutubeChannelArgs> = {
  time: null,
  streamerId: null,
  isOwner: 'default',
  isModerator: 'default'
}

const twitchChannelGlobalInfoComparator: ObjectComparator<CreateOrUpdateGlobalTwitchChannelArgs> = {
  time: null,
  userName: 'default',
  displayName: 'default',
  userType: 'default',
  colour: 'default'
}
const twitchChannelStreamerInfoComparator: ObjectComparator<CreateOrUpdateStreamerTwitchChannelArgs> = {
  time: null,
  streamerId: null,
  isBroadcaster: 'default',
  isSubscriber: 'default',
  isMod: 'default',
  isVip: 'default'
}

function globalChannelInfoHasChanged (
  platform: ChatPlatform,
  storedInfo: SafeOmit<YoutubeChannelGlobalInfo, 'imageId'> | TwitchChannelGlobalInfo,
  newInfo: SafeOmit<CreateOrUpdateGlobalYoutubeChannelArgs, 'imageId'> | CreateOrUpdateGlobalTwitchChannelArgs
): boolean {
  let comparator: ObjectComparator<SafeOmit<CreateOrUpdateGlobalYoutubeChannelArgs, 'imageId'>> | ObjectComparator<CreateOrUpdateGlobalTwitchChannelArgs>
  if (platform === 'youtube') {
    comparator = youtubeChannelGlobalInfoComparator
  } else if (platform === 'twitch') {
    comparator = twitchChannelGlobalInfoComparator
  } else {
    assertUnreachable(platform)
  }

  return storedInfo!.time < newInfo.time && !compare(storedInfo, newInfo, comparator)
}

function streamerChannelInfoHasChanged (platform: ChatPlatform, storedInfo: YoutubeChannelStreamerInfo | TwitchChannelStreamerInfo, newInfo: CreateOrUpdateStreamerYoutubeChannelArgs | CreateOrUpdateStreamerTwitchChannelArgs): boolean {
  let comparator: ObjectComparator<CreateOrUpdateStreamerYoutubeChannelArgs> | ObjectComparator<CreateOrUpdateStreamerTwitchChannelArgs>
  if (platform === 'youtube') {
    comparator = youtubeChannelStreamerInfoComparator
  } else if (platform === 'twitch') {
    comparator = twitchChannelStreamerInfoComparator
  } else {
    assertUnreachable(platform)
  }

  return storedInfo!.time < newInfo.time && !compare(storedInfo, newInfo, comparator)
}
