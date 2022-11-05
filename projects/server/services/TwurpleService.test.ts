import { Dependencies } from '@rebel/server/context/context'
import { ChatItem } from '@rebel/server/models/chat'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import ChatService from '@rebel/server/services/ChatService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import { cast, nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { ChatClient } from '@twurple/chat'
import { mock, MockProxy } from 'jest-mock-extended'
import * as chat from '@rebel/server/models/chat'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import EventDispatchService, { DataPair } from '@rebel/server/services/EventDispatchService'
import AccountStore from '@rebel/server/stores/AccountStore'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { RegisteredUser, Streamer } from '@prisma/client'

const onMessage_example = '{"msgId":"c2ddc7b6-51b6-4d75-9670-d262a6e98cf1","userInfo":{"userName":"chat_mate1","displayName":"chat_mate1","color":"#0000FF","badges":{},"badgeInfo":{},"userId":"781376034","userType":"","isBroadcaster":true,"isSubscriber":false,"isFounder":false,"isMod":false,"isVip":false},"channelId":"781376034","isCheer":false,"bits":0,"emoteOffsets":{},"messageParts":[{"type":"emote","position":0,"length":2,"id":"1","name":":)","displayInfo":{}},{"type":"text","position":2,"length":1,"text":" "},{"type":"emote","position":3,"length":6,"id":"301544927","name":"SirUwU","displayInfo":{}},{"type":"text","position":9,"length":1,"text":" "},{"type":"emote","position":10,"length":7,"id":"30259","name":"HeyGuys","displayInfo":{}}]}'
const twitchChannelName = 'rebel_guymc'

let mockTwurpleChatClientProvider: MockProxy<TwurpleChatClientProvider>
let mockChatClient: MockProxy<ChatClient>
let mockTwurpleApiProxyService: MockProxy<TwurpleApiProxyService>
let mockChannelStore: MockProxy<ChannelStore>
let mockEventDispatchService: MockProxy<EventDispatchService>
let mockAccountStore: MockProxy<AccountStore>
let mockStreamerStore: MockProxy<StreamerStore>
let twurpleService: TwurpleService

beforeEach(() => {
  mockChatClient = mock()
  mockTwurpleChatClientProvider = mock()
  mockTwurpleChatClientProvider.get.mockReturnValue(mockChatClient)
  mockTwurpleApiProxyService = mock()
  mockChannelStore = mock()
  mockEventDispatchService = mock()
  mockAccountStore = mock()
  mockStreamerStore = mock()

  twurpleService = new TwurpleService(new Dependencies({
    logService: mock(),
    twurpleChatClientProvider: mockTwurpleChatClientProvider,
    disableExternalApis: false,
    twurpleApiProxyService: mockTwurpleApiProxyService,
    twitchChannelName: twitchChannelName,
    channelStore: mockChannelStore,
    eventDispatchService: mockEventDispatchService,
    accountStore: mockAccountStore,
    streamerStore: mockStreamerStore
  }))
})

describe(nameof(TwurpleService, 'initialise'), () => {
  test('does not initialise if api disabled', () => {
    twurpleService = new TwurpleService(new Dependencies({
      logService: mock(),
      twurpleChatClientProvider: mockTwurpleChatClientProvider,
      disableExternalApis: true,
      twurpleApiProxyService: mockTwurpleApiProxyService,
      twitchChannelName: twitchChannelName,
      channelStore: mockChannelStore,
      eventDispatchService: mockEventDispatchService,
      accountStore: mockAccountStore,
      streamerStore: mockStreamerStore
    }))

    twurpleService.initialise()

    expect(mockChatClient.onMessage.mock.calls.length).toBe(0)
    expect(mockEventDispatchService.addData.mock.calls.length).toBe(0)
  })

  test('passes new chat message to the EventDispatchService', async () => {
    const twitchMessage = JSON.parse(onMessage_example)
    const chatItem: ChatItem = cast<ChatItem>({ id: 'id' })
    const evalMockFn = jest.spyOn(chat, 'evalTwitchPrivateMessage').mockImplementation(msg_ => chatItem)
    const channel = 'channel'
    const chatUserId = 2
    const registeredUserId = 3
    const streamerId = 4
    mockChannelStore.getUserId.calledWith(channel).mockResolvedValue(chatUserId)
    mockAccountStore.getRegisteredUserFromChatUser.calledWith(chatUserId).mockResolvedValue(cast<RegisteredUser>({ id: registeredUserId }))
    mockStreamerStore.getStreamerByRegisteredUserId.calledWith(registeredUserId).mockResolvedValue(cast<Streamer>({ id: streamerId }))

    twurpleService.initialise()

    const callback = mockChatClient.onMessage.mock.calls[0][0] as (...args: any) => Promise<void> //  :  -  (
    await callback(channel, 'user', 'message', twitchMessage)

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
    const channelId = 5
    const channelName = 'testChannelName'
    const reason = 'test reason'
    mockChannelStore.getTwitchUserNameFromChannelId.calledWith(channelId).mockResolvedValue(channelName)

    await twurpleService.banChannel(channelId, reason)

    expect(single(mockTwurpleApiProxyService.ban.mock.calls)).toEqual([channelName, reason])
  })
})

describe(nameof(TwurpleService, 'unbanChannel'), () => {
  test('gets channel name and makes a request to unban', async () => {
    const channelId = 5
    const channelName = 'testChannelName'
    mockChannelStore.getTwitchUserNameFromChannelId.calledWith(channelId).mockResolvedValue(channelName)

    await twurpleService.unbanChannel(channelId)

    expect(single(mockTwurpleApiProxyService.say.mock.calls)).toEqual([`/unban ${channelName}`])
  })
})

describe(nameof(TwurpleService, 'modChannel'), () => {
  test('gets channel name and makes a request to mod', async () => {
    const channelId = 5
    const userChannelName = 'testChannelName'
    mockChannelStore.getTwitchUserNameFromChannelId.calledWith(channelId).mockResolvedValue(userChannelName)

    await twurpleService.modChannel(channelId)

    expect(single(mockTwurpleApiProxyService.mod.mock.calls)).toEqual([twitchChannelName, userChannelName])
  })
})

describe(nameof(TwurpleService, 'unmodChannel'), () => {
  test('gets channel name and makes a request to unmod', async () => {
    const channelId = 5
    const userChannelName = 'testChannelName'
    mockChannelStore.getTwitchUserNameFromChannelId.calledWith(channelId).mockResolvedValue(userChannelName)

    await twurpleService.unmodChannel(channelId)

    expect(single(mockTwurpleApiProxyService.unmod.mock.calls)).toEqual([twitchChannelName, userChannelName])
  })
})
