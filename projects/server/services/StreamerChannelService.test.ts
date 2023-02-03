import { ChatUser, RegisteredUser, Streamer } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import EventDispatchService from '@rebel/server/services/EventDispatchService'
import StreamerChannelService, { TwitchStreamerChannel } from '@rebel/server/services/StreamerChannelService'
import AccountStore from '@rebel/server/stores/AccountStore'
import ChannelStore, { TwitchChannelWithLatestInfo, UserChannel, UserOwnedChannels } from '@rebel/server/stores/ChannelStore'
import StreamerChannelStore, { PrimaryChannels } from '@rebel/server/stores/StreamerChannelStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { single } from '@rebel/server/util/arrays'
import { ForbiddenError } from '@rebel/server/util/error'
import { cast, expectArray, expectObjectDeep, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockStreamerStore: MockProxy<StreamerStore>
let mockStreamerChannelStore: MockProxy<StreamerChannelStore>
let mockEventDispatchService: MockProxy<EventDispatchService>
let mockAccountStore: MockProxy<AccountStore>
let mockChannelStore: MockProxy<ChannelStore>
let streamerChannelService: StreamerChannelService

beforeEach(() => {
  mockStreamerStore = mock()
  mockStreamerChannelStore = mock()
  mockEventDispatchService = mock()
  mockAccountStore = mock()
  mockChannelStore = mock()

  streamerChannelService = new StreamerChannelService(new Dependencies({
    streamerStore: mockStreamerStore,
    streamerChannelStore: mockStreamerChannelStore,
    eventDispatchService: mockEventDispatchService,
    accountStore: mockAccountStore,
    channelStore: mockChannelStore,
  }))
})

describe(nameof(StreamerChannelService, 'getAllTwitchStreamerChannels'), () => {
  test('Returns the primary Twitch channel names of all streamers', async () => {
    const streamerId1 = 1
    const streamerId2 = 2
    const streamerId3 = 3
    const twitchName1 = 'name1'
    const twitchName2 = 'name2'

    mockStreamerStore.getStreamers.calledWith().mockResolvedValue([cast<Streamer>({ id: streamerId1 }), cast<Streamer>({ id: streamerId2 }), cast<Streamer>({ id: streamerId3 })])
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray<number>([streamerId1, streamerId2, streamerId3])).mockResolvedValue(cast<PrimaryChannels[]>([
      { streamerId: streamerId1, twitchChannel: { platformInfo: { platform: 'twitch', channel: { infoHistory: [{ displayName: twitchName1 }]}}} },
      { streamerId: streamerId2, twitchChannel: { platformInfo: { platform: 'twitch', channel: { infoHistory: [{ displayName: twitchName2 }]}}} },
      { streamerId: streamerId3, twitchChannel: null }
    ]))

    const result = await streamerChannelService.getAllTwitchStreamerChannels()

    expect(result).toEqual<TwitchStreamerChannel[]>([
      {streamerId: streamerId1, twitchChannelName: twitchName1 },
      {streamerId: streamerId2, twitchChannelName: twitchName2 }
    ])
  })
})

describe(nameof(StreamerChannelService, 'getTwitchChannelName'), () => {
  test(`Returns the streamer's linked Twitch channel`, async () => {
    const streamerId = 1
    const twitchName = 'name'
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray<number>([streamerId])).mockResolvedValue(cast<PrimaryChannels[]>([
      { twitchChannel: { platformInfo: { platform: 'twitch', channel: { infoHistory: [{ displayName: twitchName }]}}} }
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
    expect(eventArgs).toEqual(expectObjectDeep(eventArgs, ['addPrimaryChannel', { streamerId, userChannel }]))
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

  test('Throws if the primary user is already set', async () => {
    const streamerId = 4
    const registeredUserId = 91
    const aggregateChatUserId = 58
    const youtubeChannelId = 581
    const err = new Error()

    mockStreamerStore.getStreamerById.calledWith(streamerId).mockResolvedValue(cast<Streamer>({ registeredUserId }))
    mockAccountStore.getRegisteredUsersFromIds.calledWith(expectArray<number>([registeredUserId])).mockResolvedValue([cast<RegisteredUser>({ aggregateChatUserId })])
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expectArray<number>([aggregateChatUserId])).mockResolvedValue([cast<UserOwnedChannels>({ youtubeChannelIds: [youtubeChannelId] })])
    mockStreamerChannelStore.setStreamerYoutubeChannelLink.calledWith(streamerId, youtubeChannelId).mockRejectedValue(err)

    await expect(() => streamerChannelService.setPrimaryChannel(streamerId, 'youtube', youtubeChannelId)).rejects.toThrowError(err)

    expect(mockEventDispatchService.addData.mock.calls.length).toBe(0)
  })
})

describe(nameof(StreamerChannelService, 'unsetPrimaryChannel'), () => {
  test('Unsets primary channel and dispatches data', async () => {
    const streamerId = 3
    const userChannel = cast<UserChannel>({})
    mockStreamerChannelStore.deleteStreamerYoutubeChannelLink.calledWith(streamerId).mockResolvedValue(userChannel)

    await streamerChannelService.unsetPrimaryChannel(streamerId, 'youtube')

    const eventArgs = single(mockEventDispatchService.addData.mock.calls)
    expect(eventArgs).toEqual(expectObjectDeep(eventArgs, ['removePrimaryChannel', { streamerId, userChannel }]))
  })

  test('Does not dispatch data if no primary channel was unset', async () => {
    const streamerId = 3
    mockStreamerChannelStore.deleteStreamerYoutubeChannelLink.calledWith(streamerId).mockResolvedValue(null)

    await streamerChannelService.unsetPrimaryChannel(streamerId, 'youtube')

    expect(mockEventDispatchService.addData.mock.calls.length).toBe(0)
  })
})
