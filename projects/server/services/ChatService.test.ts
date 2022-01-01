import { Livestream } from '@prisma/client'
import { Action, AddChatItemAction, ChatResponse } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import { IMasterchat } from '@rebel/server/interfaces'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import ChatService from '@rebel/server/services/ChatService'
import LogService from '@rebel/server/services/LogService'
import ChatStore from '@rebel/server/stores/ChatStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { mockGetter, nameof, single } from '@rebel/server/_test/utils'
import { mock, mockDeep, MockProxy } from 'jest-mock-extended'

const token1 = 'token1'
const token2 = 'token2'
const currentLivestream: Livestream = {
  id: 1,
  liveId: 'liveId',
  continuationToken: token1,
  createdAt: new Date(),
  start: new Date(),
  end: null
}
const chatAction1: AddChatItemAction = {
  type: 'addChatItemAction',
  authorChannelId: 'author1',
  authorPhoto: 'author1.photo',
  id: 'chat1',
  isModerator: false,
  isOwner: false,
  isVerified: false,
  message: [],
  timestamp: new Date(),
  timestampUsec: String(new Date().getTime()),
  authorName: 'author1.name',
  contextMenuEndpointParams: '',
  rawMessage: []
}

let mockChatStore: MockProxy<ChatStore>
let mockLivestreamStore: MockProxy<LivestreamStore>
let mockMasterchat: MockProxy<IMasterchat>
let mockLogService: MockProxy<LogService>
let chatService: ChatService

beforeEach(() => {
  mockChatStore = mock<ChatStore>()
  mockLivestreamStore = mock<LivestreamStore>()
  mockMasterchat = mock<IMasterchat>()
  mockLogService = mock<LogService>()
  
  mockGetter(mockLivestreamStore, 'currentLivestream').mockReturnValue(currentLivestream)
  mockChatStore.getChatSince.mockResolvedValue([])

  const mockMasterchatProvider = mockDeep<MasterchatProvider>({
    get: () => mockMasterchat
  })

  jest.useFakeTimers()

  chatService = new ChatService(new Dependencies({
    chatStore: mockChatStore,
    livestreamStore: mockLivestreamStore,
    logService: mockLogService,
    masterchatProvider: mockMasterchatProvider
  }))
})

afterEach(() => {
  jest.clearAllTimers()
})

describe(nameof(ChatService, 'start'), () => {
  test('throws when starting twice', async () => {
    mockMasterchat.fetch.mockResolvedValue(createChatResponse())

    await chatService.start()

    expect(() => chatService.start()).toThrow()
  })

  test('uses continuation token when fetching and schedules new fetch', async () => {
    mockMasterchat.fetch.mockResolvedValue(createChatResponse())

    await chatService.start()

    expect(single(single(mockMasterchat.fetch.mock.calls))).toBe(token1)
    expect(jest.getTimerCount()).toBe(1)
  })

  test('quietly handles fetching error and reset continuation token', async () => {
    mockMasterchat.fetch.mockRejectedValue(new Error('Fetching failed'))

    await chatService.start()

    expect(single(single(mockLivestreamStore.update.mock.calls))).toBe(null)
  })

  test('passes chat items to ChatStore', async () => {
    mockMasterchat.fetch.mockResolvedValue(createChatResponse([chatAction1]))

    await chatService.start()

    const [passedToken, passedItem] = single(mockChatStore.addChat.mock.calls)
    expect(passedToken).toBe(token2)
    expect(single(passedItem).id).toBe(chatAction1.id)
  })
})

function createChatResponse (actions?: AddChatItemAction[]): ChatResponse {
  return {
    continuation: { token: token2, timeoutMs: 10000 },
    error: null,
    actions: actions ?? []
  }
}