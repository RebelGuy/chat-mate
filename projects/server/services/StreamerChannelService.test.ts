import { YoutubeLivestream, TwitchLivestream, RegisteredUser, Streamer, TwitchChannel } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import EventDispatchService, { EVENT_ADD_PRIMARY_CHANNEL, EVENT_REMOVE_PRIMARY_CHANNEL } from '@rebel/server/services/EventDispatchService'
import StreamerChannelService, { TwitchStreamerChannel } from '@rebel/server/services/StreamerChannelService'
import AccountStore, { RegisteredUserResult } from '@rebel/server/stores/AccountStore'
import ChannelStore, { UserChannel, UserOwnedChannels } from '@rebel/server/stores/ChannelStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import StreamerChannelStore, { PrimaryChannels } from '@rebel/server/stores/StreamerChannelStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { single } from '@rebel/shared/util/arrays'
import { ChatMateError, ForbiddenError, PrimaryChannelAlreadyExistsError, PrimaryChannelNotFoundError } from '@rebel/shared/util/error'
import { cast, expectArray, expectObjectDeep, nameof } from '@rebel/shared/testUtils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockStreamerStore: MockProxy<StreamerStore>
let mockStreamerChannelStore: MockProxy<StreamerChannelStore>
let mockEventDispatchService: MockProxy<EventDispatchService>
let mockAccountStore: MockProxy<AccountStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockLivestreamStore: MockProxy<LivestreamStore>
let streamerChannelService: StreamerChannelService

beforeEach(() => {
  mockStreamerStore = mock()
  mockStreamerChannelStore = mock()
  mockEventDispatchService = mock()
  mockAccountStore = mock()
  mockChannelStore = mock()
  mockLivestreamStore = mock()

  streamerChannelService = new StreamerChannelService(new Dependencies({
    streamerStore: mockStreamerStore,
    streamerChannelStore: mockStreamerChannelStore,
    eventDispatchService: mockEventDispatchService,
    accountStore: mockAccountStore,
    channelStore: mockChannelStore,
    livestreamStore: mockLivestreamStore
  }))
})

describe(nameof(StreamerChannelService, 'getAllTwitchStreamerChannels'), () => {
  test('Returns the primary Twitch channel names of all streamers', async () => {
    const streamerId1 = 1
    const streamerId2 = 2
    const streamerId3 = 3
    const twitchName1 = 'name1'
    const twitchName2 = 'name2'
    const internalTwitchId1 = 5
    const internalTwitchId2 = 6

    mockStreamerStore.getStreamers.calledWith().mockResolvedValue([cast<Streamer>({ id: streamerId1 }), cast<Streamer>({ id: streamerId2 }), cast<Streamer>({ id: streamerId3 })])
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray<number>([streamerId1, streamerId2, streamerId3])).mockResolvedValue(cast<PrimaryChannels[]>([
      { streamerId: streamerId1, twitchChannel: { platformInfo: { platform: 'twitch', channel: { id: internalTwitchId1, globalInfoHistory: [{ displayName: twitchName1 }]}}} },
      { streamerId: streamerId2, twitchChannel: { platformInfo: { platform: 'twitch', channel: { id: internalTwitchId2, globalInfoHistory: [{ displayName: twitchName2 }]}}} },
      { streamerId: streamerId3, twitchChannel: null }
    ]))

    const result = await streamerChannelService.getAllTwitchStreamerChannels()

    expect(result).toEqual<TwitchStreamerChannel[]>([
      {streamerId: streamerId1, twitchChannelName: twitchName1, internalChannelId: internalTwitchId1 },
      {streamerId: streamerId2, twitchChannelName: twitchName2, internalChannelId: internalTwitchId2 }
    ])
  })
})

describe(nameof(StreamerChannelService, 'getStreamerFromTwitchChannelName'), () => {
  test('Returns the streamer whose primary Twitch channel matches the given name', async () => {
    const channelName = 'testName'
    const userId = 159
    const registeredUserId = 182
    const streamerId = 5
    const twitchChannel = cast<TwitchChannel>({ userId })
    const registeredUser = cast<RegisteredUserResult>({ registeredUser: { id: registeredUserId }})
    const streamer = cast<Streamer>({ id: streamerId })
    const primaryChannels = cast<PrimaryChannels>({ twitchChannel: { platformInfo: {
      channel: { globalInfoHistory: [{ displayName: channelName.toUpperCase() }] },
      platform: 'twitch'
    }}})

    mockChannelStore.getChannelFromUserNameOrExternalId.calledWith(channelName).mockResolvedValue(twitchChannel)
    mockAccountStore.getRegisteredUsers.calledWith(expectArray<number>([userId])).mockResolvedValue([registeredUser])
    mockStreamerStore.getStreamerByRegisteredUserId.calledWith(registeredUserId).mockResolvedValue(streamer)
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray<number>([streamerId])).mockResolvedValue([primaryChannels])

    const result = await streamerChannelService.getStreamerFromTwitchChannelName(channelName)

    expect(result).toBe(streamerId)
  })
})

describe(nameof(StreamerChannelService, 'getTwitchChannelName'), () => {
  test(`Returns the streamer's linked Twitch channel`, async () => {
    const streamerId = 1
    const twitchName = 'name'
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray<number>([streamerId])).mockResolvedValue(cast<PrimaryChannels[]>([
      { twitchChannel: { platformInfo: { platform: 'twitch', channel: { globalInfoHistory: [{ displayName: twitchName }]}}} }
    ]))

    const result = await streamerChannelService.getTwitchChannelName(streamerId)

    expect(result).toBe(twitchName)
  })

  test('Returns null if the streamer does not have a primary Twitch channel selected', async () => {
    const streamerId = 1
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray<number>([streamerId])).mockResolvedValue(cast<PrimaryChannels[]>([
      { twitchChannel: null }
    ]))

    const result = await streamerChannelService.getTwitchChannelName(streamerId)

    expect(result).toBeNull()
  })
})

describe(nameof(StreamerChannelService, 'getYoutubeExternalId'), () => {
  test(`Returns the streamer's linked YouTube channel`, async () => {
    const streamerId = 125
    const youtubeId = 'testYoutubeId'
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray<number>([streamerId])).mockResolvedValue(cast<PrimaryChannels[]>([
      { youtubeChannel: { platformInfo: { channel: { youtubeId }}}}
    ]))

    const result = await streamerChannelService.getYoutubeExternalId(streamerId)

    expect(result).toBe(youtubeId)
  })

  test('Returns null if the streamer does not have a primary YouTube channel selected', async () => {
    const streamerId = 1
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray<number>([streamerId])).mockResolvedValue(cast<PrimaryChannels[]>([
      { youtubeChannel: null }
    ]))

    const result = await streamerChannelService.getYoutubeExternalId(streamerId)

    expect(result).toBeNull()
  })
})

describe(nameof(StreamerChannelService, 'setPrimaryChannel'), () => {
  test('Sets the primary youtube channel and dispatches an event', async () => {
    const streamerId = 4
    const registeredUserId = 91
    const aggregateChatUserId = 58
    const youtubeChannelId = 581
    const userChannel = cast<UserChannel>({})

    mockStreamerStore.getStreamerById.calledWith(streamerId).mockResolvedValue(cast<Streamer>({ registeredUserId }))
    mockAccountStore.getRegisteredUsersFromIds.calledWith(expectArray<number>([registeredUserId])).mockResolvedValue([cast<RegisteredUser>({ aggregateChatUserId })])
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expectArray<number>([aggregateChatUserId])).mockResolvedValue([cast<UserOwnedChannels>({ youtubeChannelIds: [youtubeChannelId] })])
    mockStreamerChannelStore.setStreamerYoutubeChannelLink.calledWith(streamerId, youtubeChannelId).mockResolvedValue(userChannel)

    await streamerChannelService.setPrimaryChannel(streamerId, 'youtube', youtubeChannelId)

    const eventArgs = single(mockEventDispatchService.addData.mock.calls)
    expect(eventArgs).toEqual(expectObjectDeep(eventArgs, [EVENT_ADD_PRIMARY_CHANNEL, { streamerId, userChannel }]))
  })

  test(`Throws ${ForbiddenError.name} if the user does not have access to the channel`, async () => {
    const streamerId = 4
    const registeredUserId = 91
    const aggregateChatUserId = 58
    const youtubeChannelId = 581

    mockStreamerStore.getStreamerById.calledWith(streamerId).mockResolvedValue(cast<Streamer>({ registeredUserId }))
    mockAccountStore.getRegisteredUsersFromIds.calledWith(expectArray<number>([registeredUserId])).mockResolvedValue([cast<RegisteredUser>({ aggregateChatUserId })])
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expectArray<number>([aggregateChatUserId])).mockResolvedValue([cast<UserOwnedChannels>({ youtubeChannelIds: [youtubeChannelId + 1] })])

    await expect(() => streamerChannelService.setPrimaryChannel(streamerId, 'youtube', youtubeChannelId)).rejects.toThrowError(ForbiddenError)

    expect(mockEventDispatchService.addData.mock.calls.length).toBe(0)
  })

  test(`Throws ${PrimaryChannelAlreadyExistsError.name} if the primary user is already set`, async () => {
    const streamerId = 4
    const registeredUserId = 91
    const aggregateChatUserId = 58
    const youtubeChannelId = 581
    const err = new PrimaryChannelAlreadyExistsError(streamerId, 'youtube')

    mockStreamerStore.getStreamerById.calledWith(streamerId).mockResolvedValue(cast<Streamer>({ registeredUserId }))
    mockAccountStore.getRegisteredUsersFromIds.calledWith(expectArray<number>([registeredUserId])).mockResolvedValue([cast<RegisteredUser>({ aggregateChatUserId })])
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expectArray<number>([aggregateChatUserId])).mockResolvedValue([cast<UserOwnedChannels>({ youtubeChannelIds: [youtubeChannelId] })])
    mockStreamerChannelStore.setStreamerYoutubeChannelLink.calledWith(streamerId, youtubeChannelId).mockRejectedValue(err)

    await expect(() => streamerChannelService.setPrimaryChannel(streamerId, 'youtube', youtubeChannelId)).rejects.toThrowError(err)

    expect(mockEventDispatchService.addData.mock.calls.length).toBe(0)
  })

  test('Throws if a livestream is currently in progress', async () => {
    const streamerId = 3
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(cast<YoutubeLivestream>({}))

    await expect(() => streamerChannelService.setPrimaryChannel(streamerId, 'youtube', 1)).rejects.toThrowError(ChatMateError)
    await expect(() => streamerChannelService.setPrimaryChannel(streamerId, 'twitch', 1)).rejects.toThrowError(ChatMateError)
  })
})

describe(nameof(StreamerChannelService, 'unsetPrimaryChannel'), () => {
  test('Unsets primary channel and dispatches data', async () => {
    const streamerId = 3
    const userChannel = cast<UserChannel>({})
    mockStreamerChannelStore.removeStreamerYoutubeChannelLink.calledWith(streamerId).mockResolvedValue(userChannel)

    await streamerChannelService.unsetPrimaryChannel(streamerId, 'youtube')

    const eventArgs = single(mockEventDispatchService.addData.mock.calls)
    expect(eventArgs).toEqual(expectObjectDeep(eventArgs, [EVENT_REMOVE_PRIMARY_CHANNEL, { streamerId, userChannel }]))
  })

  test(`Throws ${PrimaryChannelNotFoundError.name} and does not dispatch data if no primary channel exists`, async () => {
    const streamerId = 3
    const err = new PrimaryChannelNotFoundError(streamerId, 'youtube')
    mockStreamerChannelStore.removeStreamerYoutubeChannelLink.calledWith(streamerId).mockRejectedValue(err)

    await expect(() => streamerChannelService.unsetPrimaryChannel(streamerId, 'youtube')).rejects.toThrowError(err)

    expect(mockEventDispatchService.addData.mock.calls.length).toBe(0)
  })

  test('Throws if a livestream is currently in progress', async () => {
    const streamerId = 3
    mockLivestreamStore.getCurrentTwitchLivestream.calledWith(streamerId).mockResolvedValue(cast<TwitchLivestream>({}))

    await expect(() => streamerChannelService.unsetPrimaryChannel(streamerId, 'youtube')).rejects.toThrowError(ChatMateError)
    await expect(() => streamerChannelService.unsetPrimaryChannel(streamerId, 'twitch')).rejects.toThrowError(ChatMateError)
  })
})
