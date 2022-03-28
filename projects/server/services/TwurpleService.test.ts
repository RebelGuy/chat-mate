import { Dependencies } from '@rebel/server/context/context'
import { ChatItem } from '@rebel/server/models/chat'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import ChatService from '@rebel/server/services/ChatService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import { nameof, single } from '@rebel/server/_test/utils'
import { ChatClient } from '@twurple/chat/lib'
import { TwitchPrivateMessage } from '@twurple/chat/lib/commands/TwitchPrivateMessage'
import { mock, MockProxy } from 'jest-mock-extended'
import * as chat from '@rebel/server/models/chat'

const onMessage_example = '{"msgId":"c2ddc7b6-51b6-4d75-9670-d262a6e98cf1","userInfo":{"userName":"chat_mate1","displayName":"chat_mate1","color":"#0000FF","badges":{},"badgeInfo":{},"userId":"781376034","userType":"","isBroadcaster":true,"isSubscriber":false,"isFounder":false,"isMod":false,"isVip":false},"channelId":"781376034","isCheer":false,"bits":0,"emoteOffsets":{},"messageParts":[{"type":"emote","position":0,"length":2,"id":"1","name":":)","displayInfo":{}},{"type":"text","position":2,"length":1,"text":" "},{"type":"emote","position":3,"length":6,"id":"301544927","name":"SirUwU","displayInfo":{}},{"type":"text","position":9,"length":1,"text":" "},{"type":"emote","position":10,"length":7,"id":"30259","name":"HeyGuys","displayInfo":{}}]}'

let mockTwurpleChatClientProvider: MockProxy<TwurpleChatClientProvider>
let mockChatClient: MockProxy<ChatClient>
let mockChatService: MockProxy<ChatService>
let twurpleService: TwurpleService

beforeEach(() => {
  mockChatClient = mock()
  mockTwurpleChatClientProvider = mock()
  mockTwurpleChatClientProvider.get.mockReturnValue(mockChatClient)
  mockChatService = mock()

  twurpleService = new TwurpleService(new Dependencies({
    logService: mock(),
    twurpleChatClientProvider: mockTwurpleChatClientProvider,
    chatService: mockChatService,
    disableExternalApis: false
  }))
})

describe(nameof(TwurpleService, 'initialise'), () => {
  test('does not initialise if api disabled', () => {
    twurpleService = new TwurpleService(new Dependencies({
      logService: mock(),
      twurpleChatClientProvider: mockTwurpleChatClientProvider,
      chatService: mockChatService,
      disableExternalApis: true
    }))

    twurpleService.initialise()

    expect(mockChatClient.onMessage.mock.calls.length).toBe(0)
    expect(mockChatService.onNewChatItem.mock.calls.length).toBe(0)
  })

  test('passes new chat message to the ChatService', () => {
    const twitchMessage = JSON.parse(onMessage_example)
    const chatItem: ChatItem = {} as any
    const evalMockFn = jest.spyOn(chat, 'evalTwitchPrivateMessage').mockImplementation(msg_ => chatItem)
    twurpleService.initialise()
    
    const callback = mockChatClient.onMessage.mock.calls[0][0]
    callback('channel', 'user', 'message', twitchMessage)

    // check that the chat item is evaluated properly (trust the actual implementation)
    const providedTwitchMessage = single(single(evalMockFn.mock.calls))
    expect(providedTwitchMessage).toBe(twitchMessage)

    // check that the evaluated message is passed to the ChatService
    const providedChatItem: ChatItem = single(single(mockChatService.onNewChatItem.mock.calls))
    expect(providedChatItem).toBe(chatItem)
  })
})
