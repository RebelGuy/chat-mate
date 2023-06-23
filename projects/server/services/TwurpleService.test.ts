import { Dependencies } from '@rebel/shared/context/context'
import { ChatItem } from '@rebel/server/models/chat'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import TwurpleService from '@rebel/server/services/TwurpleService'
import { cast, expectArray, expectObject, mockGetter, nameof } from '@rebel/shared/testUtils'
import { single, single2 } from '@rebel/shared/util/arrays'
import { ChatClient } from '@twurple/chat'
import { DeepMockProxy, mock, mockDeep, MockProxy } from 'jest-mock-extended'
import * as chat from '@rebel/server/models/chat'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import ChannelStore, { TwitchChannelWithLatestInfo, UserChannel } from '@rebel/server/stores/ChannelStore'
import EventDispatchService, { DataPair, EventData } from '@rebel/server/services/EventDispatchService'
import AccountStore from '@rebel/server/stores/AccountStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { RegisteredUser, Streamer } from '@prisma/client'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import { ApiClient, HelixModerationApi, HelixModerator, HelixUser, HelixUserApi } from '@twurple/api/lib'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import { HelixUserData } from '@twurple/api/lib/interfaces/helix/user.external'
import { SubscriptionStatus } from '@rebel/server/services/StreamerTwitchEventService'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import { RefreshingAuthProvider } from '@twurple/auth/lib'
import { NotAuthorisedError } from '@rebel/shared/util/error'

const onMessage_example = '{"msgId":"c2ddc7b6-51b6-4d75-9670-d262a6e98cf1","userInfo":{"userName":"chat_mate1","displayName":"chat_mate1","color":"#0000FF","badges":{},"badgeInfo":{},"userId":"781376034","userType":"","isBroadcaster":true,"isSubscriber":false,"isFounder":false,"isMod":false,"isVip":false},"channelId":"781376034","isCheer":false,"bits":0,"emoteOffsets":{},"messageParts":[{"type":"emote","position":0,"length":2,"id":"1","name":":)","displayInfo":{}},{"type":"text","position":2,"length":1,"text":" "},{"type":"emote","position":3,"length":6,"id":"301544927","name":"SirUwU","displayInfo":{}},{"type":"text","position":9,"length":1,"text":" "},{"type":"emote","position":10,"length":7,"id":"30259","name":"HeyGuys","displayInfo":{}}]}'

const twitchUserId = 'userId'

let mockTwurpleChatClientProvider: MockProxy<TwurpleChatClientProvider>
let mockTwurpleApiClientProvider: MockProxy<TwurpleApiClientProvider>
let mockTwurpleAuthProvider: MockProxy<TwurpleAuthProvider>
let mockChatClient: MockProxy<ChatClient>
let mockApiClient: DeepMockProxy<ApiClient>
let mockUserApi: MockProxy<HelixUserApi>
let mockModerationApi: MockProxy<HelixModerationApi>
let mockRefreshingAuthProvider: MockProxy<RefreshingAuthProvider>
let mockTwurpleApiProxyService: MockProxy<TwurpleApiProxyService>
let mockChannelStore: MockProxy<ChannelStore>
let mockEventDispatchService: MockProxy<EventDispatchService>
let mockAccountStore: MockProxy<AccountStore>
let mockStreamerStore: MockProxy<StreamerStore>
let mockStreamerChannelService: MockProxy<StreamerChannelService>
let mockDateTimeHelpers: MockProxy<DateTimeHelpers>
const mockTwitchUsername = 'twitchUsername'
let twurpleService: TwurpleService

beforeEach(() => {
  mockChatClient = mock()
  mockTwurpleChatClientProvider = mock()
  mockTwurpleChatClientProvider.get.calledWith().mockReturnValue(mockChatClient)
  mockApiClient = mock()
  mockUserApi = mock()
  mockModerationApi = mock()
  mockGetter(mockApiClient, 'users').mockReturnValue(mockUserApi)
  mockGetter(mockApiClient, 'moderation').mockReturnValue(mockModerationApi)
  mockTwurpleApiClientProvider = mock()
  mockTwurpleApiClientProvider.get.calledWith(expect.any(String)).mockResolvedValue(mockApiClient)
  mockTwurpleApiClientProvider.get.calledWith(null).mockResolvedValue(mockApiClient)
  mockTwurpleAuthProvider = mock()
  mockRefreshingAuthProvider = mock()
  mockTwurpleAuthProvider.getUserTokenAuthProvider.calledWith(twitchUserId).mockResolvedValue(mockRefreshingAuthProvider)
  mockTwurpleApiProxyService = mock()
  mockChannelStore = mock()
  mockEventDispatchService = mock()
  mockAccountStore = mock()
  mockStreamerStore = mock()
  mockStreamerChannelService = mock()
  mockDateTimeHelpers = mock()

  twurpleService = new TwurpleService(new Dependencies({
    logService: mock(),
    twurpleChatClientProvider: mockTwurpleChatClientProvider,
    twurpleApiClientProvider: mockTwurpleApiClientProvider,
    twurpleAuthProvider: mockTwurpleAuthProvider,
    disableExternalApis: false,
    twurpleApiProxyService: mockTwurpleApiProxyService,
    channelStore: mockChannelStore,
    eventDispatchService: mockEventDispatchService,
    accountStore: mockAccountStore,
    streamerStore: mockStreamerStore,
    streamerChannelService: mockStreamerChannelService,
    isAdministrativeMode: () => false,
    dateTimeHelpers: mockDateTimeHelpers,
    twitchUsername: mockTwitchUsername
  }))

  mockStreamerChannelService.getAllTwitchStreamerChannels.calledWith().mockResolvedValue([])
})

describe(nameof(TwurpleService, 'initialise'), () => {
  test('does not initialise if api disabled', async () => {
    twurpleService = new TwurpleService(new Dependencies({
      logService: mock(),
      twurpleChatClientProvider: mockTwurpleChatClientProvider,
      twurpleApiClientProvider: mockTwurpleApiClientProvider,
      twurpleAuthProvider: mockTwurpleAuthProvider,
      disableExternalApis: true,
      twurpleApiProxyService: mockTwurpleApiProxyService,
      channelStore: mockChannelStore,
      eventDispatchService: mockEventDispatchService,
      accountStore: mockAccountStore,
      streamerStore: mockStreamerStore,
      streamerChannelService: mockStreamerChannelService,
      isAdministrativeMode: () => false,
      dateTimeHelpers: mockDateTimeHelpers,
      twitchUsername: mockTwitchUsername
    }))

    await twurpleService.initialise()

    expect(mockChatClient.onMessage.mock.calls.length).toBe(0)
    expect(mockEventDispatchService.addData.mock.calls.length).toBe(0)
  })

  test('does not initialise if in administrative mode', async () => {
    twurpleService = new TwurpleService(new Dependencies({
      logService: mock(),
      twurpleChatClientProvider: mockTwurpleChatClientProvider,
      twurpleApiClientProvider: mockTwurpleApiClientProvider,
      twurpleAuthProvider: mockTwurpleAuthProvider,
      disableExternalApis: false,
      twurpleApiProxyService: mockTwurpleApiProxyService,
      channelStore: mockChannelStore,
      eventDispatchService: mockEventDispatchService,
      accountStore: mockAccountStore,
      streamerStore: mockStreamerStore,
      streamerChannelService: mockStreamerChannelService,
      isAdministrativeMode: () => true,
      dateTimeHelpers: mockDateTimeHelpers,
      twitchUsername: mockTwitchUsername
    }))

    await twurpleService.initialise()

    expect(mockChatClient.onMessage.mock.calls.length).toBe(0)
    expect(mockEventDispatchService.addData.mock.calls.length).toBe(0)
  })

  test(`joins all streamers' channels and passes new chat message to the EventDispatchService`, async () => {
    const channelId = '12345'
    const twitchMessage = { ...JSON.parse(onMessage_example), channelId: channelId }
    const chatItem: ChatItem = cast<ChatItem>({ id: 'id' })
    const evalMockFn = jest.spyOn(chat, 'evalTwitchPrivateMessage').mockImplementation(msg_ => chatItem)
    const twitchChannelNames = ['test1', 'test2']
    const streamerId = 4
    mockStreamerChannelService.getAllTwitchStreamerChannels.mockReset()
    mockStreamerChannelService.getAllTwitchStreamerChannels.calledWith().mockResolvedValue([
      { streamerId: streamerId, twitchChannelName: twitchChannelNames[0] },
      { streamerId: streamerId + 1, twitchChannelName: twitchChannelNames[1] }
    ])

    // set up the channel name -> chat user -> registered user -> streamer conversion
    const chatUserId = 2
    const registeredUserId = 3
    mockChannelStore.getPrimaryUserId.calledWith(channelId).mockResolvedValue(chatUserId)
    mockAccountStore.getRegisteredUserFromAggregateUser.calledWith(chatUserId).mockResolvedValue(cast<RegisteredUser>({ id: registeredUserId }))
    mockStreamerStore.getStreamerByRegisteredUserId.calledWith(registeredUserId).mockResolvedValue(cast<Streamer>({ id: streamerId }))

    await twurpleService.initialise()

    // verify that we joined the streamers' channels
    const joinCalls: string[] = mockChatClient.join.mock.calls.map(args => single(args))
    expect(joinCalls).toEqual(twitchChannelNames)

    // post a mock chat message
    const callback = mockChatClient.onMessage.mock.calls[0][0] as (...args: any) => Promise<void> //  :  -  (
    await callback(twitchChannelNames[0], 'user', 'message', twitchMessage)

    // check that the chat item is evaluated properly (trust the actual implementation)
    const providedTwitchMessage = single(single(evalMockFn.mock.calls))
    expect(providedTwitchMessage).toBe(twitchMessage)

    // check that the evaluated message is passed to the EventDispatchService
    const data = single(mockEventDispatchService.addData.mock.calls) as DataPair<'chatItem'>
    expect(data[0]).toBe(`chatItem`)
    expect(data[1]).toEqual({ ...chatItem, streamerId })
  })

  test(`Joins the streamer's chat when a primary Twitch channel has been set`, async () => {
    const channelName = 'test'
    const addPrimaryChannelData = cast<EventData['addPrimaryChannel']>({ userChannel: { platformInfo: { platform: 'twitch', channel: { infoHistory: [{ displayName: channelName }]}}} })
    mockStreamerChannelService.getAllTwitchStreamerChannels.calledWith().mockResolvedValue([])

    await twurpleService.initialise()

    const cb = mockEventDispatchService.onData.mock.calls.find(args => args[0] === 'addPrimaryChannel')![1]

    await cb(addPrimaryChannelData)

    expect(single2(mockChatClient.join.mock.calls)).toBe(channelName)
  })

  test(`Leaves the streamer's chat when a primary Twitch channel has been unset`, async () => {
    const channelName = 'test'
    const removePrimaryChannelData = cast<EventData['removePrimaryChannel']>({ userChannel: { platformInfo: { platform: 'twitch', channel: { infoHistory: [{ displayName: channelName }]}}} })
    mockStreamerChannelService.getAllTwitchStreamerChannels.calledWith().mockResolvedValue([])

    await twurpleService.initialise()

    const cb = mockEventDispatchService.onData.mock.calls.find(args => args[0] === 'removePrimaryChannel')![1]

    await cb(removePrimaryChannelData)

    expect(single2(mockChatClient.part.mock.calls)).toBe(channelName)
  })
})

describe(nameof(TwurpleService, 'banChannel'), () => {
  test('gets helix users and makes a request to ban', async () => {
    const streamerId = 2
    const channelId = 5
    const streamerChannelName = 'streamerChannelName'
    const streamerHelixUser = new HelixUser(cast<HelixUserData>({ id: 'streamer' }), mockApiClient)
    const channelName = 'testChannelName'
    const channel = cast<TwitchChannelWithLatestInfo>({ infoHistory: [{ userName: channelName }] })
    const helixUser = new HelixUser(cast<HelixUserData>({ id: 'user' }), mockApiClient)
    const reason = 'test reason'
    mockChannelStore.getTwitchChannelFromChannelId.calledWith(expect.arrayContaining([channelId])).mockResolvedValue([cast<UserChannel>({ platformInfo: { platform: 'twitch', channel: channel }})])
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue(streamerChannelName)
    mockApiClient.users.getUserByName.calledWith(streamerChannelName).mockResolvedValue(streamerHelixUser)
    mockApiClient.users.getUserByName.calledWith(channelName).mockResolvedValue(helixUser)

    await twurpleService.initialise()
    await twurpleService.banChannel(streamerId, channelId, reason)

    const args = single(mockTwurpleApiProxyService.ban.mock.calls)
    expect(args).toEqual(expectArray(args, [streamerHelixUser, helixUser, reason]))
  })
})

describe(nameof(TwurpleService, 'unbanChannel'), () => {
  test('gets channel name and makes a request to unban', async () => {
    const streamerId = 2
    const channelId = 5
    const streamerChannelName = 'streamerChannelName'
    const streamerHelixUser = new HelixUser(cast<HelixUserData>({ id: 'streamer' }), mockApiClient)
    const channelName = 'testChannelName'
    const channel = cast<TwitchChannelWithLatestInfo>({ infoHistory: [{ userName: channelName }] })
    const helixUser = new HelixUser(cast<HelixUserData>({ id: 'user' }), mockApiClient)
    mockChannelStore.getTwitchChannelFromChannelId.calledWith(expect.arrayContaining([channelId])).mockResolvedValue([cast<UserChannel>({ platformInfo: { platform: 'twitch', channel: channel }})])
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue(streamerChannelName)
    mockApiClient.users.getUserByName.calledWith(streamerChannelName).mockResolvedValue(streamerHelixUser)
    mockApiClient.users.getUserByName.calledWith(channelName).mockResolvedValue(helixUser)

    await twurpleService.initialise()
    await twurpleService.unbanChannel(streamerId, channelId)

    const args = single(mockTwurpleApiProxyService.unban.mock.calls)
    expect(args).toEqual(expectArray(args, [streamerHelixUser, helixUser]))
  })
})

describe(nameof(TwurpleService, 'timeout'), () => {
  test('gets helix users and makes a request to ban', async () => {
    const streamerId = 2
    const channelId = 5
    const streamerChannelName = 'streamerChannelName'
    const streamerHelixUser = new HelixUser(cast<HelixUserData>({ id: 'streamer' }), mockApiClient)
    const channelName = 'testChannelName'
    const channel = cast<TwitchChannelWithLatestInfo>({ infoHistory: [{ userName: channelName }] })
    const helixUser = new HelixUser(cast<HelixUserData>({ id: 'user' }), mockApiClient)
    const reason = 'test reason'
    const durationSeconds = 100
    mockChannelStore.getTwitchChannelFromChannelId.calledWith(expect.arrayContaining([channelId])).mockResolvedValue([cast<UserChannel>({ platformInfo: { platform: 'twitch', channel: channel }})])
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue(streamerChannelName)
    mockApiClient.users.getUserByName.calledWith(streamerChannelName).mockResolvedValue(streamerHelixUser)
    mockApiClient.users.getUserByName.calledWith(channelName).mockResolvedValue(helixUser)

    await twurpleService.initialise()
    await twurpleService.timeout(streamerId, channelId, reason, durationSeconds)

    const args = single(mockTwurpleApiProxyService.timeout.mock.calls)
    expect(args).toEqual(expectArray(args, [streamerHelixUser, helixUser, durationSeconds, reason]))
  })
})

describe(nameof(TwurpleService, 'untimeout'), () => {
  test('gets channel name and makes a request to unban', async () => {
    const streamerId = 2
    const channelId = 5
    const streamerChannelName = 'streamerChannelName'
    const streamerHelixUser = new HelixUser(cast<HelixUserData>({ id: 'streamer' }), mockApiClient)
    const channelName = 'testChannelName'
    const channel = cast<TwitchChannelWithLatestInfo>({ infoHistory: [{ userName: channelName }] })
    const helixUser = new HelixUser(cast<HelixUserData>({ id: 'user' }), mockApiClient)
    mockChannelStore.getTwitchChannelFromChannelId.calledWith(expect.arrayContaining([channelId])).mockResolvedValue([cast<UserChannel>({ platformInfo: { platform: 'twitch', channel: channel }})])
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue(streamerChannelName)
    mockApiClient.users.getUserByName.calledWith(streamerChannelName).mockResolvedValue(streamerHelixUser)
    mockApiClient.users.getUserByName.calledWith(channelName).mockResolvedValue(helixUser)

    await twurpleService.initialise()
    await twurpleService.untimeout(streamerId, channelId)

    const args = single(mockTwurpleApiProxyService.unTimeout.mock.calls)
    expect(args).toEqual(expectArray(args, [streamerHelixUser, helixUser]))
  })
})

describe(nameof(TwurpleService, 'getChatStatus'), () => {
  // this should probably be split into 5 tests but I just can't be bothered rn
  test('Keeps track of initial streamers and joined/parted/failed channels and returns the correct active statuses', async () => {
    mockGetter(mockChatClient, 'isConnected').mockReturnValue(true)
    mockGetter(mockChatClient, 'isConnecting').mockReturnValue(false)

    // succeeds and stays
    const channelName1 = 'test1'
    const streamerId1 = 1
    const addPrimaryChannelData1 = cast<EventData['addPrimaryChannel']>({
      streamerId: streamerId1,
      userChannel: { platformInfo: { platform: 'twitch', channel: { infoHistory: [{ displayName: channelName1 }]}}}
    })
    const user1 = cast<HelixUser>({ id: 'userId1' })
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId1).mockResolvedValue(channelName1)
    mockUserApi.getUserByName.calledWith(channelName1).mockResolvedValue(user1)
    mockTwurpleAuthProvider.hasTokenForUser.calledWith(user1.id).mockReturnValue(true)

    // succeeds and leaves
    const channelName2 = 'test2'
    const streamerId2 = 2
    const addPrimaryChannelData2 = cast<EventData['addPrimaryChannel']>({
      streamerId: streamerId2,
      userChannel: { platformInfo: { platform: 'twitch', channel: { infoHistory: [{ displayName: channelName2 }]}}}
    })
    const user2 = cast<HelixUser>({ id: 'userId2' })
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId2).mockResolvedValue(channelName2)
    mockUserApi.getUserByName.calledWith(channelName2).mockResolvedValue(user2)
    mockTwurpleAuthProvider.hasTokenForUser.calledWith(user2.id).mockReturnValue(true)

    // fails to join
    const channelName3 = 'test3'
    const streamerId3 = 3
    const addPrimaryChannelData3 = cast<EventData['addPrimaryChannel']>({
      streamerId: streamerId3,
      userChannel: { platformInfo: { platform: 'twitch', channel: { infoHistory: [{ displayName: channelName3 }]}}}
    })
    const testErrorMessage = 'testError'
    const user3 = cast<HelixUser>({ id: 'userId3' })
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId3).mockResolvedValue(channelName3)
    mockChatClient.join.calledWith(channelName3).mockRejectedValue(new Error(testErrorMessage))
    mockUserApi.getUserByName.calledWith(channelName3).mockResolvedValue(user3)
    mockTwurpleAuthProvider.hasTokenForUser.calledWith(user3.id).mockReturnValue(true)

    // succeeds
    const channelName4 = 'test4'
    const streamerId4 = 4
    const user4 = cast<HelixUser>({ id: 'userId4' })
    mockStreamerChannelService.getAllTwitchStreamerChannels.calledWith().mockResolvedValue([{
      streamerId: streamerId4,
      twitchChannelName: channelName4
    }])
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId4).mockResolvedValue(channelName4)
    mockUserApi.getUserByName.calledWith(channelName4).mockResolvedValue(user4)
    mockTwurpleAuthProvider.hasTokenForUser.calledWith(user4.id).mockReturnValue(true)

    // doesn't have a primary Twitch channel
    const streamerId5 = 5
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId5).mockResolvedValue(null)

    await twurpleService.initialise()

    const onAddPrimaryChannel = mockEventDispatchService.onData.mock.calls.find(args => args[0] === 'addPrimaryChannel')![1]
    const onRemovePrimaryChannel = mockEventDispatchService.onData.mock.calls.find(args => args[0] === 'removePrimaryChannel')![1]

    await onAddPrimaryChannel(addPrimaryChannelData1)
    await onAddPrimaryChannel(addPrimaryChannelData2)
    await onAddPrimaryChannel(addPrimaryChannelData3)
    await onRemovePrimaryChannel(addPrimaryChannelData2) // `add` has same schema as `remove`

    const status1 = await twurpleService.getChatStatus(streamerId1)
    const status2 = await twurpleService.getChatStatus(streamerId2)
    const status3 = await twurpleService.getChatStatus(streamerId3)
    const status4 = await twurpleService.getChatStatus(streamerId4)
    const status5 = await twurpleService.getChatStatus(streamerId5)
    expect([status1, status2, status3, status4, status5]).toEqual(expectArray<SubscriptionStatus | null>([
      { status: 'active' },
      { status: 'inactive' },
      { status: 'inactive', message: testErrorMessage },
      { status: 'active' },
      null
    ]))
  })

  test('Returns pending when the chat client is currently connecting', async () => {
    const streamerId = 1
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue('')
    mockGetter(mockChatClient, 'isConnected').mockReturnValue(false)
    mockGetter(mockChatClient, 'isConnecting').mockReturnValue(true)

    await twurpleService.initialise()

    const result = await twurpleService.getChatStatus(streamerId)

    expect(result).toEqual(expectObject(result, { status: 'pending' }))
  })

  test('Returns inactive when the chat client is not connected', async () => {
    const streamerId = 1
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue('')
    mockGetter(mockChatClient, 'isConnected').mockReturnValue(false)
    mockGetter(mockChatClient, 'isConnecting').mockReturnValue(false)

    await twurpleService.initialise()

    const result = await twurpleService.getChatStatus(streamerId)

    expect(result).toEqual(expectObject(result, { status: 'inactive', message: expect.any(String) }))
  })

  test('Returns an error if the streamer requesting the status has not authorised ChatMate', async () => {
    const streamerId = 1
    const channelName = 'testchannel'
    const addPrimaryChannelData1 = cast<EventData['addPrimaryChannel']>({
      streamerId: streamerId,
      userChannel: { platformInfo: { platform: 'twitch', channel: { infoHistory: [{ displayName: channelName }]}}}
    })
    const user = cast<HelixUser>({ id: 'userId' })

    mockGetter(mockChatClient, 'isConnected').mockReturnValue(true)
    mockGetter(mockChatClient, 'isConnecting').mockReturnValue(false)
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue(channelName)
    mockUserApi.getUserByName.calledWith(channelName).mockResolvedValue(user)
    mockTwurpleAuthProvider.getUserTokenAuthProvider.calledWith(user.id).mockRejectedValue(new NotAuthorisedError(user.id))

    await twurpleService.initialise()
    const onAddPrimaryChannel = mockEventDispatchService.onData.mock.calls.find(args => args[0] === 'addPrimaryChannel')![1]
    await onAddPrimaryChannel(addPrimaryChannelData1)

    const result = await twurpleService.getChatStatus(streamerId)

    expect(result).toEqual(expectObject(result, { status: 'active', message: expect.any(String), requiresAuthorisation: true }))
  })
})

describe(nameof(TwurpleService, 'modChannel'), () => {
  test('gets channel name and makes a request to mod', async () => {
    const streamerId = 2
    const channelId = 5
    const streamerChannelName = 'streamerChannelName'
    const streamerHelixUser = new HelixUser(cast<HelixUserData>({ id: 'streamer' }), mockApiClient)
    const channelName = 'testChannelName'
    const channel = cast<TwitchChannelWithLatestInfo>({ infoHistory: [{ userName: channelName }] })
    const helixUser = new HelixUser(cast<HelixUserData>({ id: 'user' }), mockApiClient)
    mockChannelStore.getTwitchChannelFromChannelId.calledWith(expect.arrayContaining([channelId])).mockResolvedValue([cast<UserChannel>({ platformInfo: { platform: 'twitch', channel: channel }})])
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue(streamerChannelName)
    mockApiClient.users.getUserByName.calledWith(streamerChannelName).mockResolvedValue(streamerHelixUser)
    mockApiClient.users.getUserByName.calledWith(channelName).mockResolvedValue(helixUser)

    await twurpleService.initialise()
    await twurpleService.modChannel(streamerId, channelId)

    const args = single(mockTwurpleApiProxyService.mod.mock.calls)
    expect(args).toEqual(expectArray(args, [streamerHelixUser, helixUser]))
  })
})

describe(nameof(TwurpleService, 'unmodChannel'), () => {
  test('gets channel name and makes a request to unmod', async () => {
    const streamerId = 2
    const channelId = 5
    const streamerChannelName = 'streamerChannelName'
    const streamerHelixUser = new HelixUser(cast<HelixUserData>({ id: 'streamer' }), mockApiClient)
    const channelName = 'testChannelName'
    const channel = cast<TwitchChannelWithLatestInfo>({ infoHistory: [{ userName: channelName }] })
    const helixUser = new HelixUser(cast<HelixUserData>({ id: 'user' }), mockApiClient)
    mockChannelStore.getTwitchChannelFromChannelId.calledWith(expect.arrayContaining([channelId])).mockResolvedValue([cast<UserChannel>({ platformInfo: { platform: 'twitch', channel: channel }})])
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue(streamerChannelName)
    mockApiClient.users.getUserByName.calledWith(streamerChannelName).mockResolvedValue(streamerHelixUser)
    mockApiClient.users.getUserByName.calledWith(channelName).mockResolvedValue(helixUser)

    await twurpleService.initialise()
    await twurpleService.unmodChannel(streamerId, channelId)

    const args = single(mockTwurpleApiProxyService.unmod.mock.calls)
    expect(args).toEqual(expectArray(args, [streamerHelixUser, helixUser]))
  })
})
