import { Dependencies } from '@rebel/shared/context/context'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import ChannelService from '@rebel/server/services/ChannelService'
import ChannelStore, { YoutubeChannelWithLatestInfo, TwitchChannelWithLatestInfo, UserChannel, UserOwnedChannels, CreateOrUpdateGlobalYoutubeChannelArgs, CreateOrUpdateStreamerYoutubeChannelArgs, CreateOrUpdateYoutubeChannelArgs, CreateOrUpdateTwitchChannelArgs } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import { cast, expectObject, expectObjectDeep, nameof } from '@rebel/shared/testUtils'
import { single, sortBy } from '@rebel/shared/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import AccountService from '@rebel/server/services/AccountService'
import ImageService from '@rebel/server/services/ImageService'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'
import ImageStore from '@rebel/server/stores/ImageStore'
import S3ProxyService from '@rebel/server/services/S3ProxyService'
import { GroupedSemaphore } from '@rebel/shared/util/Semaphore'
import { Image, TwitchChannelStreamerInfo, YoutubeChannelStreamerInfo } from '@prisma/client'

const streamerId = 5
const externalId = 'externalId'

const mockSemaphore = new GroupedSemaphore<string>(1)

let mockChannelStore: MockProxy<ChannelStore>
let mockChatStore: MockProxy<ChatStore>
let mockAccountService: MockProxy<AccountService>
let mockImageService: MockProxy<ImageService>
let mockChatMateStateService: MockProxy<ChatMateStateService>
let mockImageStore: MockProxy<ImageStore>
let mockS3ProxyService: MockProxy<S3ProxyService>
let channelService: ChannelService

beforeEach(() => {
  mockChannelStore = mock()
  mockChatStore = mock()
  mockAccountService = mock()
  mockImageService = mock()
  mockChatMateStateService = mock()
  mockImageStore = mock()
  mockS3ProxyService = mock()

  channelService = new ChannelService(new Dependencies({
    channelStore: mockChannelStore,
    chatStore: mockChatStore,
    accountService: mockAccountService,
    imageService: mockImageService,
    chatMateStateService: mockChatMateStateService,
    imageStore: mockImageStore,
    logService: mock(),
    s3ProxyService: mockS3ProxyService
  }))

  mockChatMateStateService.getChannelSemaphore.calledWith().mockReturnValue(mockSemaphore)
})

describe(nameof(ChannelService, 'createOrUpdateYoutubeChannel'), () => {
  const imageUrl = 'https://yt4.ggpht.com/ytc/AIdro_kYPLrNqS3olctyR8r2XmDY4Sth6dZ67IBm7tq1W4lGqec=s64-c-k-c0x00ffffff-no-rj'
  const upsizedImageUrl = 'https://yt4.ggpht.com/ytc/AIdro_kYPLrNqS3olctyR8r2XmDY4Sth6dZ67IBm7tq1W4lGqec=s2048'

  test('Creates a new channel with correct image data if seeing this channel for the first time', async () => {
    const channelInfo = cast<CreateOrUpdateYoutubeChannelArgs>({ imageUrl: imageUrl })
    const createdChannel = cast<YoutubeChannelWithLatestInfo>({ id: 1 })
    const imageData = 'imageData'
    const fileName = 'channel/youtube/1/2.png'
    const relativeImageUrl = 'relativeImageUrl'
    const dimensions = { width: 20, height: 40 }

    mockChannelStore.tryGetYoutubeChannelWithLatestInfo.calledWith(externalId).mockResolvedValue(null)
    mockChannelStore.createYoutubeChannel.calledWith(externalId, channelInfo, expect.anything()).mockResolvedValue(createdChannel)
    mockImageService.convertToPng.calledWith(upsizedImageUrl, expect.anything()).mockResolvedValue(imageData)
    mockS3ProxyService.constructRelativeUrl.calledWith(fileName).mockReturnValue(relativeImageUrl)
    mockImageService.getImageDimensions.calledWith(imageData).mockReturnValue(dimensions)

    const result = await channelService.createOrUpdateYoutubeChannel(externalId, channelInfo)

    expect(result).toBe(createdChannel)

    // ensure we get the correct image info and upload it to s3
    const onGetImageInfo = single(mockChannelStore.createYoutubeChannel.mock.calls)[2]
    const imageInfo = await onGetImageInfo(1, 2)
    expect(imageInfo).toEqual<typeof imageInfo>({ relativeImageUrl: relativeImageUrl, imageWidth: dimensions.width, imageHeight: dimensions.height })

    const uploadToS3Args = single(mockS3ProxyService.uploadBase64Image.mock.calls)
    expect(uploadToS3Args[0]).toBe(fileName)
    expect(uploadToS3Args[3]).toBe(imageData)
  })

  test('Returns the existing channel if nothing has changed', async () => {
    const channelInfo = cast<CreateOrUpdateYoutubeChannelArgs>({ streamerId: streamerId, time: data.time2, imageUrl: 'imageUrl', isVerified: false, isModerator: false })
    const existingChannel = cast<YoutubeChannelWithLatestInfo>({ id: 4, globalInfoHistory: [{ time: data.time1, imageUrl: 'imageUrl', isVerified: false }] })

    mockChannelStore.tryGetYoutubeChannelWithLatestInfo.calledWith(externalId).mockResolvedValue(existingChannel)
    mockImageStore.getImageByFingerprint.calledWith(expect.any(String)).mockResolvedValue(cast<Image>({ }))
    mockChannelStore.getYoutubeChannelHistoryForStreamer.calledWith(streamerId, existingChannel.id, 1).mockResolvedValue(cast<YoutubeChannelStreamerInfo[]>([{ time: data.time1, isModerator: false }]))

    const result = await channelService.createOrUpdateYoutubeChannel(externalId, channelInfo)

    expect(result).toBe(existingChannel)
    expect(mockChannelStore.updateYoutubeChannel_Global.mock.calls.length).toBe(0)
    expect(mockChannelStore.updateYoutubeChannel_Streamer.mock.calls.length).toBe(0)
  })

  test('Updates the global info if details have changed', async () => {
    const imageId = 5
    const channelInfo = cast<CreateOrUpdateYoutubeChannelArgs>({ streamerId: streamerId, time: data.time2, imageUrl: 'imageUrl', isVerified: true, isModerator: false })
    const existingChannel = cast<YoutubeChannelWithLatestInfo>({ id: 4, globalInfoHistory: [{ time: data.time1, imageUrl: 'imageUrl', isVerified: false, imageId: imageId }] })
    const updatedChannel = cast<YoutubeChannelWithLatestInfo>({ id: 4, globalInfoHistory: [{ time: data.time2, imageUrl: 'imageUrl', isVerified: true, imageId: imageId }] })

    mockChannelStore.tryGetYoutubeChannelWithLatestInfo.calledWith(externalId).mockResolvedValue(existingChannel)
    mockImageStore.getImageByFingerprint.calledWith(expect.any(String)).mockResolvedValue(cast<Image>({ }))
    mockChannelStore.updateYoutubeChannel_Global.calledWith(externalId, channelInfo, imageId, null).mockResolvedValue(updatedChannel)
    mockChannelStore.getYoutubeChannelHistoryForStreamer.calledWith(streamerId, existingChannel.id, 1).mockResolvedValue(cast<YoutubeChannelStreamerInfo[]>([{ time: data.time1, isModerator: false }]))

    const result = await channelService.createOrUpdateYoutubeChannel(externalId, channelInfo)

    expect(result).toBe(updatedChannel)
    expect(mockChannelStore.updateYoutubeChannel_Streamer.mock.calls.length).toBe(0)
  })

  test('Updates the global info if the image has changed', async () => {
    const imageId = 5
    const channelInfo = cast<CreateOrUpdateYoutubeChannelArgs>({ streamerId: streamerId, time: data.time2, imageUrl: imageUrl, isVerified: true, isModerator: false })
    const existingChannel = cast<YoutubeChannelWithLatestInfo>({ id: 4, globalInfoHistory: [{ time: data.time1, imageUrl: 'oldImageUrl', isVerified: false, imageId: imageId }] })
    const updatedChannel = cast<YoutubeChannelWithLatestInfo>({ id: 4, globalInfoHistory: [{ time: data.time2, imageUrl: imageUrl, isVerified: false, imageId: imageId }] })
    const imageData = 'imageData'
    const fileName = 'channel/youtube/1/2.png'
    const relativeImageUrl = 'relativeImageUrl'
    const dimensions = { width: 20, height: 40 }

    mockChannelStore.tryGetYoutubeChannelWithLatestInfo.calledWith(externalId).mockResolvedValue(existingChannel)
    mockImageStore.getImageByFingerprint.calledWith(expect.any(String)).mockResolvedValue(null) // we don't yet have the image saved
    mockChannelStore.updateYoutubeChannel_Global.calledWith(externalId, channelInfo, imageId, expect.anything()).mockResolvedValue(updatedChannel)
    mockChannelStore.getYoutubeChannelHistoryForStreamer.calledWith(streamerId, existingChannel.id, 1).mockResolvedValue(cast<YoutubeChannelStreamerInfo[]>([{ time: data.time1, isModerator: false }]))
    mockImageService.convertToPng.calledWith(upsizedImageUrl, expect.anything()).mockResolvedValue(imageData)
    mockS3ProxyService.constructRelativeUrl.calledWith(fileName).mockReturnValue(relativeImageUrl)
    mockImageService.getImageDimensions.calledWith(imageData).mockReturnValue(dimensions)

    const result = await channelService.createOrUpdateYoutubeChannel(externalId, channelInfo)

    expect(result).toBe(updatedChannel)
    expect(mockChannelStore.updateYoutubeChannel_Streamer.mock.calls.length).toBe(0)

    // ensure we get the correct image info and upload it to s3
    const onGetImageInfo = single(mockChannelStore.updateYoutubeChannel_Global.mock.calls)[3]!
    const imageInfo = await onGetImageInfo(1, 2)
    expect(imageInfo).toEqual<typeof imageInfo>({ relativeImageUrl: relativeImageUrl, imageWidth: dimensions.width, imageHeight: dimensions.height })

    const uploadToS3Args = single(mockS3ProxyService.uploadBase64Image.mock.calls)
    expect(uploadToS3Args[0]).toBe(fileName)
    expect(uploadToS3Args[3]).toBe(imageData)
  })

  test('Updates the streamer info if channel seen for the first time', async () => {
    const channelInfo = cast<CreateOrUpdateYoutubeChannelArgs>({ streamerId: streamerId, time: data.time2, imageUrl: 'imageUrl', isVerified: false, isModerator: true })
    const existingChannel = cast<YoutubeChannelWithLatestInfo>({ id: 4, globalInfoHistory: [{ time: data.time1, imageUrl: 'imageUrl', isVerified: false }] })

    mockChannelStore.tryGetYoutubeChannelWithLatestInfo.calledWith(externalId).mockResolvedValue(existingChannel)
    mockImageStore.getImageByFingerprint.calledWith(expect.any(String)).mockResolvedValue(cast<Image>({ }))
    mockChannelStore.getYoutubeChannelHistoryForStreamer.calledWith(streamerId, existingChannel.id, 1).mockResolvedValue(cast<YoutubeChannelStreamerInfo[]>([]))

    const result = await channelService.createOrUpdateYoutubeChannel(externalId, channelInfo)

    expect(result).toBe(existingChannel)
    expect(mockChannelStore.updateYoutubeChannel_Global.mock.calls.length).toBe(0)

    const updateStreamerInfoArgs = single(mockChannelStore.updateYoutubeChannel_Streamer.mock.calls)
    expect(updateStreamerInfoArgs).toEqual<typeof updateStreamerInfoArgs>([externalId, channelInfo as CreateOrUpdateStreamerYoutubeChannelArgs])
  })

  test('Updates the streamer info if details have changed', async () => {
    const channelInfo = cast<CreateOrUpdateYoutubeChannelArgs>({ streamerId: streamerId, time: data.time2, imageUrl: 'imageUrl', isVerified: false, isModerator: true })
    const existingChannel = cast<YoutubeChannelWithLatestInfo>({ id: 4, globalInfoHistory: [{ time: data.time1, imageUrl: 'imageUrl', isVerified: false }] })

    mockChannelStore.tryGetYoutubeChannelWithLatestInfo.calledWith(externalId).mockResolvedValue(existingChannel)
    mockImageStore.getImageByFingerprint.calledWith(expect.any(String)).mockResolvedValue(cast<Image>({ }))
    mockChannelStore.getYoutubeChannelHistoryForStreamer.calledWith(streamerId, existingChannel.id, 1).mockResolvedValue(cast<YoutubeChannelStreamerInfo[]>([{ time: data.time1, isModerator: false }]))

    const result = await channelService.createOrUpdateYoutubeChannel(externalId, channelInfo)

    expect(result).toBe(existingChannel)
    expect(mockChannelStore.updateYoutubeChannel_Global.mock.calls.length).toBe(0)

    const updateStreamerInfoArgs = single(mockChannelStore.updateYoutubeChannel_Streamer.mock.calls)
    expect(updateStreamerInfoArgs).toEqual<typeof updateStreamerInfoArgs>([externalId, channelInfo as CreateOrUpdateStreamerYoutubeChannelArgs])
  })
})

describe(nameof(ChannelService, 'getOrCreateYoutubeChannel'), () => {
  test('Returns the existing channel', async () => {
    const existingChannel = {} as any
    mockChannelStore.tryGetYoutubeChannelWithLatestInfo.calledWith(externalId).mockResolvedValue(existingChannel)

    const result = await channelService.getOrCreateYoutubeChannel(externalId, '', '', false)

    expect(result).toBe(existingChannel)
  })

  test(`Creates a new channel if it doesn't exist`, async () => {
    const name = 'name'
    const image = 'image'
    const isVerified = false
    mockChannelStore.tryGetYoutubeChannelWithLatestInfo.calledWith(externalId).mockResolvedValue(null)

    await channelService.getOrCreateYoutubeChannel(externalId, name, image, isVerified)

    const args = single(mockChannelStore.createYoutubeChannel.mock.calls)
    expect(args).toEqual<typeof args>([
      externalId,
      expectObject({ name: name, imageUrl: image, isVerified: isVerified, streamerId: null, time: expect.any(Date) }),
      expect.anything()
    ])
  })
})

describe(nameof(ChannelService, 'createOrUpdateTwitchChannel'), () => {
  test('Creates a new channel if seeing this channel for the first time', async () => {
    const channelInfo = cast<CreateOrUpdateTwitchChannelArgs>({ displayName: 'test' })
    const createdChannel = cast<TwitchChannelWithLatestInfo>({ id: 1 })

    mockChannelStore.tryGetTwitchChannelWithLatestInfo.calledWith(externalId).mockResolvedValue(null)
    mockChannelStore.createTwitchChannel.calledWith(externalId, channelInfo).mockResolvedValue(createdChannel)

    const result = await channelService.createOrUpdateTwitchChannel(externalId, channelInfo)

    expect(result).toBe(createdChannel)
  })

  test('Returns the existing channel if nothing has changed', async () => {
    const channelInfo = cast<CreateOrUpdateTwitchChannelArgs>({ streamerId: streamerId, time: data.time2, displayName: 'abc', isMod: false })
    const existingChannel = cast<TwitchChannelWithLatestInfo>({ id: 4, globalInfoHistory: [{ time: data.time1, displayName: 'abc' }] })

    mockChannelStore.tryGetTwitchChannelWithLatestInfo.calledWith(externalId).mockResolvedValue(existingChannel)
    mockChannelStore.getTwitchChannelHistoryForStreamer.calledWith(streamerId, existingChannel.id, 1).mockResolvedValue(cast<TwitchChannelStreamerInfo[]>([{ time: data.time1, isMod: false }]))

    const result = await channelService.createOrUpdateTwitchChannel(externalId, channelInfo)

    expect(result).toBe(existingChannel)
    expect(mockChannelStore.updateTwitchChannel_Global.mock.calls.length).toBe(0)
    expect(mockChannelStore.updateTwitchChannel_Streamer.mock.calls.length).toBe(0)
  })

  test('Updates the global info if details have changed', async () => {
    const channelInfo = cast<CreateOrUpdateTwitchChannelArgs>({ streamerId: streamerId, time: data.time2, displayName: 'ABC', isMod: false })
    const existingChannel = cast<TwitchChannelWithLatestInfo>({ id: 4, globalInfoHistory: [{ time: data.time1, displayName: 'abc' }] })
    const updatedChannel = cast<TwitchChannelWithLatestInfo>({ id: 4, globalInfoHistory: [{ time: data.time2, displayName: 'ABC' }] })

    mockChannelStore.tryGetTwitchChannelWithLatestInfo.calledWith(externalId).mockResolvedValue(existingChannel)
    mockChannelStore.updateTwitchChannel_Global.calledWith(externalId, channelInfo).mockResolvedValue(updatedChannel)
    mockChannelStore.getTwitchChannelHistoryForStreamer.calledWith(streamerId, existingChannel.id, 1).mockResolvedValue(cast<TwitchChannelStreamerInfo[]>([{ time: data.time1, isMod: false }]))

    const result = await channelService.createOrUpdateTwitchChannel(externalId, channelInfo)

    expect(result).toBe(updatedChannel)
    expect(mockChannelStore.updateTwitchChannel_Streamer.mock.calls.length).toBe(0)
  })

  test('Updates the streamer info if channel seen for the first time', async () => {
    const channelInfo = cast<CreateOrUpdateTwitchChannelArgs>({ streamerId: streamerId, time: data.time2, displayName: 'abc', isMod: false })
    const existingChannel = cast<TwitchChannelWithLatestInfo>({ id: 4, globalInfoHistory: [{ time: data.time1, displayName: 'abc' }] })

    mockChannelStore.tryGetTwitchChannelWithLatestInfo.calledWith(externalId).mockResolvedValue(existingChannel)
    mockChannelStore.getTwitchChannelHistoryForStreamer.calledWith(streamerId, existingChannel.id, 1).mockResolvedValue(cast<TwitchChannelStreamerInfo[]>([]))

    const result = await channelService.createOrUpdateTwitchChannel(externalId, channelInfo)

    expect(result).toBe(existingChannel)
    expect(mockChannelStore.updateTwitchChannel_Global.mock.calls.length).toBe(0)

    const updateStreamerInfoArgs = single(mockChannelStore.updateTwitchChannel_Streamer.mock.calls)
    expect(updateStreamerInfoArgs).toEqual<typeof updateStreamerInfoArgs>([externalId, channelInfo])
  })

  test('Updates the streamer info if details have changed', async () => {
    const channelInfo = cast<CreateOrUpdateTwitchChannelArgs>({ streamerId: streamerId, time: data.time2, displayName: 'abc', isMod: true })
    const existingChannel = cast<TwitchChannelWithLatestInfo>({ id: 4, globalInfoHistory: [{ time: data.time1, displayName: 'abc' }] })

    mockChannelStore.tryGetTwitchChannelWithLatestInfo.calledWith(externalId).mockResolvedValue(existingChannel)
    mockChannelStore.getTwitchChannelHistoryForStreamer.calledWith(streamerId, existingChannel.id, 1).mockResolvedValue(cast<TwitchChannelStreamerInfo[]>([{ time: data.time1, isMod: false }]))

    const result = await channelService.createOrUpdateTwitchChannel(externalId, channelInfo)

    expect(result).toBe(existingChannel)
    expect(mockChannelStore.updateTwitchChannel_Global.mock.calls.length).toBe(0)

    const updateStreamerInfoArgs = single(mockChannelStore.updateTwitchChannel_Streamer.mock.calls)
    expect(updateStreamerInfoArgs).toEqual<typeof updateStreamerInfoArgs>([externalId, channelInfo])
  })
})

describe(nameof(ChannelService, 'getActiveUserChannels'), () => {
  const channel1: YoutubeChannelWithLatestInfo = {} as any
  const chatItem1 = cast<ChatItemWithRelations>({
    userId: 1,
    youtubeChannelId: 10, youtubeChannel: channel1,
    twitchChannelId: null, twitchChannel: null,
    time: data.time1,
    user: { aggregateChatUserId: 3 }
  })
  const channel2: TwitchChannelWithLatestInfo = {} as any
  const chatItem2 = cast<ChatItemWithRelations>({
    userId: 2,
    youtubeChannelId: null, youtubeChannel: null,
    twitchChannelId: 5, twitchChannel: channel2,
    time: data.time2,
    user: { aggregateChatUserId: null }
  })

  test('returns all active user channels', async () => {
    const primaryUserIds = [3, 2]
    mockAccountService.getStreamerPrimaryUserIds.calledWith(streamerId).mockResolvedValue(primaryUserIds)
    mockChatStore.getLastChatOfUsers.calledWith(streamerId, primaryUserIds).mockResolvedValue([chatItem1, chatItem2])

    const result = await channelService.getActiveUserChannels(streamerId, null)

    expect(result.length).toBe(2)
    expect(result.find(r => r.defaultUserId === 1)).toEqual(expectObjectDeep<UserChannel>({
      defaultUserId: 1,
      aggregateUserId: 3, // from chat item 1
      platformInfo: {
        platform: 'youtube',
        channel: channel1
      }
    }))
    expect(result.find(r => r.defaultUserId === 2)).toEqual(expectObjectDeep<UserChannel>({
      defaultUserId: 2,
      aggregateUserId: null,
      platformInfo: {
        platform: 'twitch',
        channel: channel2
      }
    }))
  })

  test('returns specified active user channels', async () => {
    mockChatStore.getLastChatOfUsers.calledWith(streamerId, expect.arrayContaining([3])).mockResolvedValue([chatItem1 as ChatItemWithRelations])

    const result = await channelService.getActiveUserChannels(streamerId, [3])

    expect(single(result)).toEqual(expect.objectContaining<UserChannel>({
      defaultUserId: 1,
      aggregateUserId: 3, // from chat item 1
      platformInfo: {
        platform: 'youtube',
        channel: channel1
      }
    }))
  })
})

describe(nameof(ChannelService, 'getConnectedUserChannels'), () => {
  test('Gets channel info of connected channels', async () => {
    const userId1 = 123
    const userId2 = 354
    const youtubeChannel1 = cast<UserChannel>({ platformInfo: { channel: { id: 10, globalInfoHistory: [{ name: 'name1' }] }} })
    const youtubeChannel2 = cast<UserChannel>({ platformInfo: { channel: { id: 20, globalInfoHistory: [{ name: 'name2' }] }} })
    const twitchChannel1 = cast<UserChannel>({ platformInfo: { channel: { id: 10, globalInfoHistory: [{ userName: 'name3' }] }} })
    const twitchChannel2 = cast<UserChannel>({ platformInfo: { channel: { id: 25, globalInfoHistory: [{ userName: 'name4' }] }} })
    const connectedChannelIds1 = cast<UserOwnedChannels>({
      userId: userId1,
      aggregateUserId: 45,
      youtubeChannelIds: [10],
      twitchChannelIds: [10, 25]
    })
    const connectedChannelIds2 = cast<UserOwnedChannels>({
      userId: userId2,
      aggregateUserId: null,
      youtubeChannelIds: [20],
      twitchChannelIds: []
    })
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([userId1, userId2])).mockResolvedValue([connectedChannelIds1, connectedChannelIds2])
    mockChannelStore.getYoutubeChannelsFromChannelIds.calledWith(expect.arrayContaining([10, 20])).mockResolvedValue([youtubeChannel1, youtubeChannel2])
    mockChannelStore.getTwitchChannelsFromChannelIds.calledWith(expect.arrayContaining([10, 25])).mockResolvedValue([twitchChannel1, twitchChannel2])

    const result = await channelService.getConnectedUserChannels([userId1, userId2])

    expect(result.length).toBe(2)
    expect(sortBy(result, c => c.userId)).toEqual(expectObjectDeep(result, [
      { aggregateUserId: 45, channels: [youtubeChannel1, twitchChannel1, twitchChannel2] },
      { aggregateUserId: null, channels: [youtubeChannel2] }
    ]))
  })
})

describe(nameof(ChannelService, 'searchChannelsByName'), () => {
  test('Returns best match', async () => {
    const allChannels: UserChannel[] = cast<UserChannel[]>([
      { platformInfo: { platform: 'youtube', channel: { globalInfoHistory: [{ name: 'Mr Cool Guy' }] }} },
      { platformInfo: { platform: 'youtube', channel: { globalInfoHistory: [{ name: 'Rebel_Guy' }] }} },
      { platformInfo: { platform: 'twitch', channel: { globalInfoHistory: [{ displayName: 'Rebel_Guy2' }] }} },
      { platformInfo: { platform: 'twitch', channel: { globalInfoHistory: [{ displayName: 'Test' }] }} },
    ])
    mockChannelStore.getAllChannels.calledWith(streamerId).mockResolvedValue(allChannels)

    const result = await channelService.searchChannelsByName(streamerId, 'rebel', false)

    expect(result.length).toBe(2)
    expect(result).toEqual(expectObjectDeep(result, [
      allChannels[1], allChannels[2]
    ]))
  })

  test('Returns exact match', async () => {
    const allChannels: UserChannel[] = cast<UserChannel[]>([
      { platformInfo: { platform: 'youtube', channel: { globalInfoHistory: [{ name: 'Mr Cool Guy' }] }} },
      { platformInfo: { platform: 'youtube', channel: { globalInfoHistory: [{ name: 'Rebel_Guy' }] }} },
      { platformInfo: { platform: 'twitch', channel: { globalInfoHistory: [{ displayName: 'Rebel_Guy2' }] }} },
      { platformInfo: { platform: 'twitch', channel: { globalInfoHistory: [{ displayName: 'Test' }] }} },
    ])
    mockChannelStore.getAllChannels.calledWith(streamerId).mockResolvedValue(allChannels)

    const result = await channelService.searchChannelsByName(streamerId, 'Rebel_Guy', true)

    expect(result.length).toBe(1)
    expect(result).toEqual(expectObjectDeep(result, [
      allChannels[1]
    ]))
  })
})
