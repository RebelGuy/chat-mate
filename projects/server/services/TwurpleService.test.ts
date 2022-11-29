import { Dependencies } from '@rebel/server/context/context'
import { ChatItem } from '@rebel/server/models/chat'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import ChatService from '@rebel/server/services/ChatService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import { cast, nameof } from '@rebel/server/_test/utils'
import { single, single2 } from '@rebel/server/util/arrays'
import { ChatClient } from '@twurple/chat'
import { mock, MockProxy } from 'jest-mock-extended'
import * as chat from '@rebel/server/models/chat'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import EventDispatchService, { DataPair } from '@rebel/server/services/EventDispatchService'
import AccountStore from '@rebel/server/stores/AccountStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { RegisteredUser, Streamer } from '@prisma/client'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'

const onMessage_example = '{"msgId":"c2ddc7b6-51b6-4d75-9670-d262a6e98cf1","userInfo":{"userName":"chat_mate1","displayName":"chat_mate1","color":"#0000FF","badges":{},"badgeInfo":{},"userId":"781376034","userType":"","isBroadcaster":true,"isSubscriber":false,"isFounder":false,"isMod":false,"isVip":false},"channelId":"781376034","isCheer":false,"bits":0,"emoteOffsets":{},"messageParts":[{"type":"emote","position":0,"length":2,"id":"1","name":":)","displayInfo":{}},{"type":"text","position":2,"length":1,"text":" "},{"type":"emote","position":3,"length":6,"id":"301544927","name":"SirUwU","displayInfo":{}},{"type":"text","position":9,"length":1,"text":" "},{"type":"emote","position":10,"length":7,"id":"30259","name":"HeyGuys","displayInfo":{}}]}'

let mockTwurpleChatClientProvider: MockProxy<TwurpleChatClientProvider>
let mockChatClient: MockProxy<ChatClient>
let mockTwurpleApiProxyService: MockProxy<TwurpleApiProxyService>
let mockChannelStore: MockProxy<ChannelStore>
let mockEventDispatchService: MockProxy<EventDispatchService>
let mockAccountStore: MockProxy<AccountStore>
let mockStreamerStore: MockProxy<StreamerStore>
let mockStreamerChannelService: MockProxy<StreamerChannelService>
let twurpleService: TwurpleService

beforeEach(() => {
  mockChatClient = mock()
  mockTwurpleChatClientProvider = mock()
  mockTwurpleChatClientProvider.get.calledWith().mockReturnValue(mockChatClient)
  mockTwurpleApiProxyService = mock()
  mockChannelStore = mock()
  mockEventDispatchService = mock()
  mockAccountStore = mock()
  mockStreamerStore = mock()
  mockStreamerChannelService = mock()

  twurpleService = new TwurpleService(new Dependencies({
    logService: mock(),
    twurpleChatClientProvider: mockTwurpleChatClientProvider,
    disableExternalApis: false,
    twurpleApiProxyService: mockTwurpleApiProxyService,
    channelStore: mockChannelStore,
    eventDispatchService: mockEventDispatchService,
    accountStore: mockAccountStore,
    streamerStore: mockStreamerStore,
    streamerChannelService: mockStreamerChannelService
  }))
})

describe(nameof(TwurpleService, 'initialise'), () => {
  test('does not initialise if api disabled', async () => {
    twurpleService = new TwurpleService(new Dependencies({
      logService: mock(),
      twurpleChatClientProvider: mockTwurpleChatClientProvider,
      disableExternalApis: true,
      twurpleApiProxyService: mockTwurpleApiProxyService,
      channelStore: mockChannelStore,
      eventDispatchService: mockEventDispatchService,
      accountStore: mockAccountStore,
      streamerStore: mockStreamerStore,
      streamerChannelService: mockStreamerChannelService
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
    mockStreamerChannelService.getAllTwitchStreamerChannels.calledWith().mockResolvedValue([
      { streamerId: streamerId, twitchChannelName: twitchChannelNames[0] },
      { streamerId: streamerId + 1, twitchChannelName: twitchChannelNames[1] }
    ])

    // set up the channel name -> chat user -> registered user -> streamer conversion
    const chatUserId = 2
    const registeredUserId = 3
    mockChannelStore.getUserId.calledWith(channelId).mockResolvedValue(chatUserId)
    mockAccountStore.getRegisteredUserFromChatUser.calledWith(chatUserId).mockResolvedValue(cast<RegisteredUser>({ id: registeredUserId }))
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
    const data: DataPair<'chatItem'> = single(mockEventDispatchService.addData.mock.calls)
    expect(data[0]).toBe(`chatItem`)
    expect(data[1]).toEqual({ ...chatItem, streamerId })
  })
})

describe(nameof(TwurpleService, 'banChannel'), () => {
  test('gets channel name and makes a request to ban', async () => {
    const streamerId = 2
    const channelId = 5
    const streamerChannelName = 'streamerChannelName'
    const channelName = 'testChannelName'
    const reason = 'test reason'
    mockChannelStore.getTwitchUserNameFromChannelId.calledWith(channelId).mockResolvedValue(channelName)
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue(streamerChannelName)

    await twurpleService.banChannel(streamerId, channelId, reason)

    expect(single(mockTwurpleApiProxyService.ban.mock.calls)).toEqual([streamerChannelName, channelName, reason])
  })
})

describe(nameof(TwurpleService, 'unbanChannel'), () => {
  test('gets channel name and makes a request to unban', async () => {
    const streamerId = 2
    const channelId = 5
    const streamerChannelName = 'streamerChannelName'
    const channelName = 'testChannelName'
    mockChannelStore.getTwitchUserNameFromChannelId.calledWith(channelId).mockResolvedValue(channelName)
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue(streamerChannelName)

    await twurpleService.unbanChannel(streamerId, channelId)

    expect(single(mockTwurpleApiProxyService.say.mock.calls)).toEqual([streamerChannelName, `/unban ${channelName}`])
  })
})

describe(nameof(TwurpleService, 'joinChannel'), () => {
  test('Instructs the chat client to join the channel', async () => {
    const streamerId = 4
    const twitchChannelName = 'twitchChannelName'
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue(twitchChannelName)
    mockStreamerChannelService.getAllTwitchStreamerChannels.calledWith().mockResolvedValue([])

    await twurpleService.initialise()
    await twurpleService.joinChannel(streamerId)

    const receivedChannelName = single2(mockChatClient.join.mock.calls)
    expect(receivedChannelName).toBe(twitchChannelName)
  })
})

describe(nameof(TwurpleService, 'modChannel'), () => {
  test('gets channel name and makes a request to mod', async () => {
    const streamerId = 2
    const channelId = 5
    const streamerChannelName = 'streamerChannelName'
    const userChannelName = 'testChannelName'
    mockChannelStore.getTwitchUserNameFromChannelId.calledWith(channelId).mockResolvedValue(userChannelName)
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue(streamerChannelName)

    await twurpleService.modChannel(streamerId, channelId)

    expect(single(mockTwurpleApiProxyService.mod.mock.calls)).toEqual([streamerChannelName, userChannelName])
  })
})

describe(nameof(TwurpleService, 'unmodChannel'), () => {
  test('gets channel name and makes a request to unmod', async () => {
    const streamerId = 2
    const channelId = 5
    const streamerChannelName = 'streamerChannelName'
    const userChannelName = 'testChannelName'
    mockChannelStore.getTwitchUserNameFromChannelId.calledWith(channelId).mockResolvedValue(userChannelName)
    mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue(streamerChannelName)

    await twurpleService.unmodChannel(streamerId, channelId)

    expect(single(mockTwurpleApiProxyService.unmod.mock.calls)).toEqual([streamerChannelName, userChannelName])
  })
})
