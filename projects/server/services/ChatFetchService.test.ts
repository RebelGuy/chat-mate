import { Livestream } from '@prisma/client'
import { AddChatItemAction, ChatResponse, YTRun } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import ChatFetchService from '@rebel/server/services/ChatFetchService'
import ChatService from '@rebel/server/services/ChatService'
import LogService from '@rebel/server/services/LogService'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import ChatStore from '@rebel/server/stores/ChatStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { CalledWithMock, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'

// jest is having trouble mocking the correct overload method, so we have to force it into the correct type
type CreateRepeatingTimer = CalledWithMock<Promise<number>, [TimerOptions, true]>

const token1 = 'token1'
const token2 = 'token2'
const currentLivestream: Livestream = {
  id: 1,
  liveId: 'liveId',
  continuationToken: token1,
  createdAt: new Date(),
  start: new Date(),
  end: null,
  type: 'publicLivestream',
  isActive: true
}
const ytRun: YTRun = { text: 'mock message' }
const chatAction1: AddChatItemAction = {
  type: 'addChatItemAction',
  authorChannelId: 'author1',
  authorPhoto: 'author1.photo',
  id: 'chat1',
  isModerator: false,
  isOwner: false,
  isVerified: false,
  message: [ytRun],
  timestamp: data.time1,
  timestampUsec: String(data.time1.getTime()),
  authorName: 'author1.name',
  contextMenuEndpointParams: '',
  rawMessage: []
}
const chatAction2: AddChatItemAction = {
  type: 'addChatItemAction',
  authorChannelId: 'author1',
  authorPhoto: 'author1.photo',
  id: 'chat1',
  isModerator: false,
  isOwner: false,
  isVerified: false,
  message: [ytRun],
  timestamp: data.time2,
  timestampUsec: String(data.time2.getTime()),
  authorName: 'author1.name',
  contextMenuEndpointParams: '',
  rawMessage: []
}

let mockChatStore: MockProxy<ChatStore>
let mockLivestreamStore: MockProxy<LivestreamStore>
let mockMasterchatProxyService: MockProxy<MasterchatProxyService>
let mockLogService: MockProxy<LogService>
let mockTimerHelpers: MockProxy<TimerHelpers>
let mockChatService: MockProxy<ChatService>
let chatFetchService: ChatFetchService

beforeEach(() => {
  mockChatStore = mock<ChatStore>()
  mockLivestreamStore = mock<LivestreamStore>()
  mockMasterchatProxyService = mock<MasterchatProxyService>()
  mockLogService = mock<LogService>()
  mockTimerHelpers = mock<TimerHelpers>()
  mockChatService = mock<ChatService>()

  mockLivestreamStore.getActiveLivestream.mockResolvedValue(currentLivestream)
  mockChatStore.getChatSince.mockResolvedValue([])

  // automatically execute callback passed to TimerHelpers
  const createRepeatingTimer = mockTimerHelpers.createRepeatingTimer as any as CreateRepeatingTimer
  createRepeatingTimer.mockImplementation(async (options, runImmediately) => {
    await options.callback()
    return 0
  })

  chatFetchService = new ChatFetchService(new Dependencies({
    chatService: mockChatService,
    chatStore: mockChatStore,
    livestreamStore: mockLivestreamStore,
    logService: mockLogService,
    masterchatProxyService: mockMasterchatProxyService,
    timerHelpers: mockTimerHelpers,
    disableExternalApis: false
  }))
})

describe(nameof(ChatService, 'initialise'), () => {
  test('ignores api if disableExternalApis is true', async () => {
    chatFetchService = new ChatFetchService(new Dependencies({
      chatService: mockChatService,
      chatStore: mockChatStore,
      livestreamStore: mockLivestreamStore,
      logService: mockLogService,
      masterchatProxyService: mockMasterchatProxyService,
      timerHelpers: mockTimerHelpers,
      disableExternalApis: true
    }))

    await chatFetchService.initialise()

    expect(mockTimerHelpers.createRepeatingTimer.mock.calls.length).toBe(0)
    expect(mockMasterchatProxyService.fetchMetadata.mock.calls.length).toBe(0)
  })

  test('uses continuation token when fetching and schedules new fetch', async () => {
    mockMasterchatProxyService.fetch.mockResolvedValue(createChatResponse())

    await chatFetchService.initialise()

    // don't need to explicitly check return type of the callback because the type guard already checks this
    const expectedTimerOptions: TimerOptions = { behaviour: 'dynamicEnd', callback: expect.any(Function) }
    expect(single(mockTimerHelpers.createRepeatingTimer.mock.calls)).toEqual([expectedTimerOptions, true])

    expect(single(mockMasterchatProxyService.fetch.mock.calls)).toEqual([currentLivestream.liveId, token1])
  })

  test('quietly handles fetching error and reset continuation token', async () => {
    mockMasterchatProxyService.fetch.mockRejectedValue(new Error('Fetching failed'))

    await chatFetchService.initialise()

    expect(single(mockLivestreamStore.setContinuationToken.mock.calls)).toEqual([currentLivestream.liveId, null])
  })

  test('quietly handles no active livestream', async () => {
    mockLivestreamStore.getActiveLivestream.mockResolvedValue(null)

    await chatFetchService.initialise()

    expect(mockLivestreamStore.setContinuationToken.mock.calls.length).toBe(0)
    expect(mockTimerHelpers.dispose.mock.calls.length).toBe(0)
  })

  test('passes ordered chat items to ChatService and updates continuation token', async () => {
    mockMasterchatProxyService.fetch.mockResolvedValue(createChatResponse([chatAction2, chatAction1]))
    mockChatService.onNewChatItem.mockResolvedValue(true)

    await chatFetchService.initialise()

    expect(mockChatService.onNewChatItem.mock.calls.length).toBe(2)
    const [passedChatItem1] = mockChatService.onNewChatItem.mock.calls[0]
    expect(passedChatItem1.id).toBe(chatAction1.id)
    const [passedChatItem2] = mockChatService.onNewChatItem.mock.calls[1]
    expect(passedChatItem2.id).toBe(chatAction2.id)

    const [passedLiveId, passedToken] = single(mockLivestreamStore.setContinuationToken.mock.calls)
    expect(passedLiveId).toBe(currentLivestream.liveId)
    expect(passedToken).toBe(token2)
  })

  test('does not update continuation token if chat service reports error', async () => {
    mockMasterchatProxyService.fetch.mockResolvedValue(createChatResponse([chatAction1]))
    mockChatService.onNewChatItem.mockResolvedValue(false)

    await chatFetchService.initialise()

    const [passedChatItem] = single(mockChatService.onNewChatItem.mock.calls)
    expect(passedChatItem.id).toBe(chatAction1.id)

    expect(mockLivestreamStore.setContinuationToken.mock.calls.length).toBe(0)
  })
})

function createChatResponse (actions?: AddChatItemAction[]): ChatResponse {
  return {
    continuation: { token: token2, timeoutMs: 10000 },
    error: null,
    actions: actions ?? []
  }
}
