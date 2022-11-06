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
import { cast, expectArray, expectObject, nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { CalledWithMock, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { ChatItem } from '@rebel/server/models/chat'

// jest is having trouble mocking the correct overload method, so we have to force it into the correct type
type CreateRepeatingTimer = CalledWithMock<Promise<number>, [TimerOptions, true]>

const token1 = 'token1'
const token2 = 'token2'
const token3 = 'token3'
const token4 = 'token4'
const streamer1 = 1
const streamer2 = 2
const currentLivestreams: Livestream[] = [{
  id: 1,
  liveId: 'liveId1',
  streamerId: streamer1,
  continuationToken: token1,
  createdAt: new Date(),
  start: new Date(),
  end: null,
  type: 'publicLivestream',
  isActive: true
}, {
  id: 1,
  liveId: 'liveId2',
  streamerId: streamer2,
  continuationToken: token3,
  createdAt: new Date(),
  start: new Date(),
  end: null,
  type: 'publicLivestream',
  isActive: true
}]
const chatAction1: AddChatItemAction = cast<AddChatItemAction>({
  type: 'addChatItemAction',
  id: 'chat1',
  timestamp: data.time1,
  message: cast<YTRun[]>([{}, {}])
})
const chatAction2: AddChatItemAction = cast<AddChatItemAction>({
  type: 'addChatItemAction',
  id: 'chat2',
  timestamp: data.time2,
  message: cast<YTRun[]>([{}, {}])
})
const chatAction3: AddChatItemAction = cast<AddChatItemAction>({
  type: 'addChatItemAction',
  id: 'chat3',
  timestamp: data.time3,
  message: cast<YTRun[]>([{}, {}])
})

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

  mockLivestreamStore.getActiveLivestreams.mockResolvedValue(currentLivestreams)
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
    mockMasterchatProxyService.fetch.calledWith(currentLivestreams[0].liveId, currentLivestreams[0].continuationToken!).mockResolvedValue(createChatResponse(token2))
    mockMasterchatProxyService.fetch.calledWith(currentLivestreams[1].liveId, currentLivestreams[1].continuationToken!).mockResolvedValue(createChatResponse(token4))

    await chatFetchService.initialise()

    // don't need to explicitly check return type of the callback because the type guard already checks this
    const expectedTimerOptions: TimerOptions = { behaviour: 'dynamicEnd', callback: expect.any(Function) }
    expect(single(mockTimerHelpers.createRepeatingTimer.mock.calls)).toEqual([expectedTimerOptions, true])

    const calls = mockMasterchatProxyService.fetch.mock.calls
    expect(calls.length).toBe(2)
    expect(calls).toEqual(expectArray<[liveId: string, continuationToken: string | null]>([
      [currentLivestreams[0].liveId, token1],
      [currentLivestreams[1].liveId, token3]
    ]))
  })

  test('quietly handles fetching error and reset continuation token', async () => {
    mockMasterchatProxyService.fetch.calledWith(currentLivestreams[0].liveId, currentLivestreams[0].continuationToken!).mockRejectedValue(new Error('Fetching failed'))
    mockMasterchatProxyService.fetch.calledWith(currentLivestreams[1].liveId, currentLivestreams[1].continuationToken!).mockResolvedValue(createChatResponse(token4))

    await chatFetchService.initialise()

    const calls = mockLivestreamStore.setContinuationToken.mock.calls
    expect(calls.length).toBe(2)
    expect(calls).toEqual(expectArray<[liveId: string, continuationToken: string | null]>([
      [currentLivestreams[0].liveId, null],
      [currentLivestreams[1].liveId, token4]
    ]))
  })

  test('quietly handles no active livestream', async () => {
    mockLivestreamStore.getActiveLivestreams.mockResolvedValue([])

    await chatFetchService.initialise()

    expect(mockLivestreamStore.setContinuationToken.mock.calls.length).toBe(0)
    expect(mockTimerHelpers.dispose.mock.calls.length).toBe(0)
  })

  test('passes ordered chat items to ChatService and updates continuation token', async () => {
    mockMasterchatProxyService.fetch.calledWith(currentLivestreams[0].liveId, currentLivestreams[0].continuationToken!).mockResolvedValue(createChatResponse(token2, [chatAction2, chatAction1]))
    mockMasterchatProxyService.fetch.calledWith(currentLivestreams[1].liveId, currentLivestreams[1].continuationToken!).mockResolvedValue(createChatResponse(token4, [chatAction3]))
    mockChatService.onNewChatItem.mockResolvedValue(true)

    await chatFetchService.initialise()

    const chatServiceCalls = mockChatService.onNewChatItem.mock.calls
    expect(chatServiceCalls.length).toBe(3)
    // we can't be sure of the order, due to the async nature of the implementation
    expect(chatServiceCalls).toEqual(expectArray<[item: ChatItem, streamerId: number]>([
      [expectObject<ChatItem>({ id: chatAction1.id }), streamer1],
      [expectObject<ChatItem>({ id: chatAction2.id }), streamer1],
      [expectObject<ChatItem>({ id: chatAction3.id }), streamer2]
    ]))

    const livestreamStoreCalls = mockLivestreamStore.setContinuationToken.mock.calls
    expect(livestreamStoreCalls.length).toBe(2)
    expect(livestreamStoreCalls).toEqual(expectArray<[liveId: string, continuationToken: string | null]>([
      [currentLivestreams[0].liveId, token2],
      [currentLivestreams[1].liveId, token4]
    ]))
  })

  test('does not update continuation token if chat service reports error', async () => {
    mockMasterchatProxyService.fetch.calledWith(currentLivestreams[0].liveId, currentLivestreams[0].continuationToken!).mockResolvedValue(createChatResponse(token2, [chatAction1]))
    mockMasterchatProxyService.fetch.calledWith(currentLivestreams[1].liveId, currentLivestreams[1].continuationToken!).mockResolvedValue(createChatResponse(token4, [chatAction3]))
    mockChatService.onNewChatItem.calledWith(expectObject<ChatItem>({ id: chatAction1.id }), streamer1).mockResolvedValue(false)
    mockChatService.onNewChatItem.calledWith(expectObject<ChatItem>({ id: chatAction3.id }), streamer2).mockResolvedValue(true)

    await chatFetchService.initialise()

    expect(mockLivestreamStore.setContinuationToken.mock.calls.length).toBe(1)
  })
})

function createChatResponse (continuationToken: string, actions?: AddChatItemAction[]): ChatResponse {
  return {
    continuation: { token: continuationToken, timeoutMs: 10000 },
    error: null,
    actions: actions ?? []
  }
}
