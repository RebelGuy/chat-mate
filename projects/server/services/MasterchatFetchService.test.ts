import { Livestream } from '@prisma/client'
import { Action, AddChatItemAction, ChatResponse, HideUserAction, MarkChatItemAsDeletedAction, UnhideUserAction, YTRun } from '@rebel/masterchat'
import { Dependencies } from '@rebel/shared/context/context'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import MasterchatFetchService from '@rebel/server/services/MasterchatFetchService'
import ChatService from '@rebel/server/services/ChatService'
import LogService from '@rebel/server/services/LogService'
import MasterchatService from '@rebel/server/services/MasterchatService'
import ChatStore from '@rebel/server/stores/ChatStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { cast, expectArray, expectObject, nameof } from '@rebel/shared/testUtils'
import { CalledWithMock, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { ChatItem } from '@rebel/server/models/chat'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import MasterchatStore from '@rebel/server/stores/MasterchatStore'
import ExternalRankEventService from '@rebel/server/services/rank/ExternalRankEventService'
import { single, single2 } from '@rebel/shared/util/arrays'

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
  isActive: true
}, {
  id: 2,
  liveId: 'liveId2',
  streamerId: streamer2,
  continuationToken: token3,
  createdAt: new Date(),
  start: new Date(),
  end: null,
  isActive: true
}]
const chatAction1 = cast<AddChatItemAction>({
  type: 'addChatItemAction',
  id: 'chat1',
  timestamp: data.time1,
  message: cast<YTRun[]>([{}, {}])
})
const chatAction2 = cast<AddChatItemAction>({
  type: 'addChatItemAction',
  id: 'chat2',
  timestamp: data.time2,
  message: cast<YTRun[]>([{}, {}])
})
const chatAction3 = cast<AddChatItemAction>({
  type: 'addChatItemAction',
  id: 'chat3',
  timestamp: data.time3,
  message: cast<YTRun[]>([{}, {}])
})
const chatAction4 = cast<HideUserAction>({
  type: 'hideUserAction',
  timestamp: data.time4,
  timestampUsec: `${data.time4.getTime() * 1000}`,
  moderatorChannelName: 'modName1',
  userChannelName: 'userName1'
})
const chatAction5 = cast<UnhideUserAction>({
  type: 'unhideUserAction',
  timestamp: data.time3,
  timestampUsec: `${data.time3.getTime() * 1000}`,
  moderatorChannelName: 'modName2',
  userChannelName: 'userName2'
})
const chatAction6 = cast<MarkChatItemAsDeletedAction>({
  type: 'markChatItemAsDeletedAction',
  targetId: 'externalId'
})

let mockChatStore: MockProxy<ChatStore>
let mockLivestreamStore: MockProxy<LivestreamStore>
let mockMasterchatService: MockProxy<MasterchatService>
let mockLogService: MockProxy<LogService>
let mockTimerHelpers: MockProxy<TimerHelpers>
let mockChatService: MockProxy<ChatService>
let mockChatMateRegisteredUserName = 'mockChatMateRegisteredUserName'
let mockStreamerStore: MockProxy<StreamerStore>
let mockMasterchatStore: MockProxy<MasterchatStore>
let mockExternalRankEventService: MockProxy<ExternalRankEventService>
let masterchatFetchService: MasterchatFetchService

beforeEach(() => {
  mockChatStore = mock()
  mockLivestreamStore = mock()
  mockMasterchatService = mock()
  mockLogService = mock()
  mockTimerHelpers = mock()
  mockChatService = mock()
  mockStreamerStore = mock()
  mockMasterchatStore = mock()
  mockExternalRankEventService = mock()

  mockLivestreamStore.getActiveLivestreams.calledWith().mockResolvedValue(currentLivestreams)
  mockChatStore.getChatSince.calledWith(expect.any(Number), expect.any(Number), undefined, undefined).mockResolvedValue([])
  mockLivestreamStore.getActiveLivestream.mockImplementation(streamerId => Promise.resolve(currentLivestreams.find(l => l.streamerId === streamerId)!))

  // automatically execute callback passed to TimerHelpers
  const createRepeatingTimer = mockTimerHelpers.createRepeatingTimer as any as CreateRepeatingTimer
  createRepeatingTimer.mockImplementation(async (options, runImmediately) => {
    await options.callback()
    return 0
  })

  masterchatFetchService = new MasterchatFetchService(new Dependencies({
    chatService: mockChatService,
    chatStore: mockChatStore,
    livestreamStore: mockLivestreamStore,
    logService: mockLogService,
    masterchatService: mockMasterchatService,
    timerHelpers: mockTimerHelpers,
    disableExternalApis: false,
    chatMateRegisteredUserName: mockChatMateRegisteredUserName,
    streamerStore: mockStreamerStore,
    masterchatStore: mockMasterchatStore,
    externalRankEventService: mockExternalRankEventService,
    isAdministrativeMode: () => false
  }))
})

describe(nameof(MasterchatFetchService, 'initialise'), () => {
  test('ignores api if disableExternalApis is true', async () => {
    masterchatFetchService = new MasterchatFetchService(new Dependencies({
      chatService: mockChatService,
      chatStore: mockChatStore,
      livestreamStore: mockLivestreamStore,
      logService: mockLogService,
      masterchatService: mockMasterchatService,
      timerHelpers: mockTimerHelpers,
      disableExternalApis: true,
      chatMateRegisteredUserName: mockChatMateRegisteredUserName,
      streamerStore: mockStreamerStore,
      masterchatStore: mockMasterchatStore,
      externalRankEventService: mockExternalRankEventService,
      isAdministrativeMode: () => false
    }))

    await masterchatFetchService.initialise()

    expect(mockTimerHelpers.createRepeatingTimer.mock.calls.length).toBe(0)
    expect(mockMasterchatService.fetchMetadata.mock.calls.length).toBe(0)
  })

  test('Schedules chat fetch for each active livestream', async () => {
    mockMasterchatService.fetch.calledWith(currentLivestreams[0].streamerId, currentLivestreams[0].continuationToken!).mockResolvedValue(createChatResponse(token2))
    mockMasterchatService.fetch.calledWith(currentLivestreams[1].streamerId, currentLivestreams[1].continuationToken!).mockResolvedValue(createChatResponse(token4))

    await masterchatFetchService.initialise()

    expect(mockTimerHelpers.createRepeatingTimer.mock.calls.length).toBe(3)

    const calls = mockMasterchatService.fetch.mock.calls
    expect(calls.length).toBe(2)
    expect(calls).toEqual(expectArray<[streamerId: number, continuationToken: string | null]>([
      [currentLivestreams[0].streamerId, token1],
      [currentLivestreams[1].streamerId, token3]
    ]))
  })

  test('Quietly handles fetching error and reset continuation token', async () => {
    mockMasterchatService.fetch.calledWith(currentLivestreams[0].streamerId, currentLivestreams[0].continuationToken!).mockRejectedValue(new Error('Fetching failed'))
    mockMasterchatService.fetch.calledWith(currentLivestreams[1].streamerId, currentLivestreams[1].continuationToken!).mockResolvedValue(createChatResponse(token4))

    await masterchatFetchService.initialise()

    const calls = mockLivestreamStore.setContinuationToken.mock.calls
    expect(calls.length).toBe(2)
    expect(calls).toEqual(expectArray<[liveId: string, continuationToken: string | null]>([
      [currentLivestreams[0].liveId, null],
      [currentLivestreams[1].liveId, token4]
    ]))
  })

  test('Quietly handles no active livestream', async () => {
    mockLivestreamStore.getActiveLivestreams.calledWith().mockResolvedValue([])

    await masterchatFetchService.initialise()

    expect(mockLivestreamStore.setContinuationToken.mock.calls.length).toBe(0)
    expect(mockTimerHelpers.dispose.mock.calls.length).toBe(0)
  })

  test('Passes ordered chat items to ChatService and updates continuation token', async () => {
    mockMasterchatService.fetch.calledWith(currentLivestreams[0].streamerId, currentLivestreams[0].continuationToken!).mockResolvedValue(createChatResponse(token2, [chatAction2, chatAction1]))
    mockMasterchatService.fetch.calledWith(currentLivestreams[1].streamerId, currentLivestreams[1].continuationToken!).mockResolvedValue(createChatResponse(token4, [chatAction3]))
    mockChatService.onNewChatItem.calledWith(expect.anything(), expect.anything()).mockResolvedValue(true)

    await masterchatFetchService.initialise()

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

  test('Does not update continuation token if chat service throws error', async () => {
    mockMasterchatService.fetch.calledWith(currentLivestreams[0].streamerId, currentLivestreams[0].continuationToken!).mockResolvedValue(createChatResponse(token2, [chatAction1]))
    mockMasterchatService.fetch.calledWith(currentLivestreams[1].streamerId, currentLivestreams[1].continuationToken!).mockResolvedValue(createChatResponse(token4, [chatAction3]))
    mockChatService.onNewChatItem.calledWith(expectObject<ChatItem>({ id: chatAction1.id }), streamer1).mockRejectedValue(new Error())
    mockChatService.onNewChatItem.calledWith(expectObject<ChatItem>({ id: chatAction3.id }), streamer2).mockResolvedValue(true)

    await masterchatFetchService.initialise()

    expect(mockLivestreamStore.setContinuationToken.mock.calls.length).toBe(1)
  })

  test('Persists hide user action and unhide user action and notifies service', async () => {
    mockMasterchatService.fetch.calledWith(currentLivestreams[0].streamerId, currentLivestreams[0].continuationToken!).mockResolvedValue(createChatResponse(token2, [chatAction4, chatAction5]))
    mockMasterchatStore.hasActionWithTime.calledWith(chatAction4.type, chatAction4.timestamp.getTime(), currentLivestreams[0].liveId).mockResolvedValue(false)
    mockMasterchatStore.hasActionWithTime.calledWith(chatAction5.type, chatAction5.timestamp.getTime(), currentLivestreams[0].liveId).mockResolvedValue(false)

    await masterchatFetchService.initialise()

    const [addCall1, addCall2] = mockMasterchatStore.addMasterchatAction.mock.calls
    expect(addCall1).toEqual<typeof addCall1>([chatAction4.type, JSON.stringify(chatAction4), chatAction4.timestamp.getTime(), currentLivestreams[0].liveId])
    expect(addCall2).toEqual<typeof addCall1>([chatAction5.type, JSON.stringify(chatAction5), chatAction5.timestamp.getTime(), currentLivestreams[0].liveId])

    const banCall = single(mockExternalRankEventService.onYoutubeChannelBanned.mock.calls)
    expect(banCall).toEqual<typeof banCall>([currentLivestreams[0].streamerId, chatAction4.userChannelName, chatAction4.moderatorChannelName])

    const unbanCall = single(mockExternalRankEventService.onYoutubeChannelUnbanned.mock.calls)
    expect(unbanCall).toEqual<typeof unbanCall>([currentLivestreams[0].streamerId, chatAction5.userChannelName, chatAction5.moderatorChannelName])
  })

  test('Does not process hide or unhide action if already exists', async () => {
    mockMasterchatService.fetch.calledWith(currentLivestreams[0].streamerId, currentLivestreams[0].continuationToken!).mockResolvedValue(createChatResponse(token2, [chatAction4, chatAction5]))
    mockMasterchatStore.hasActionWithTime.calledWith(chatAction4.type, chatAction4.timestamp.getTime(), currentLivestreams[0].liveId).mockResolvedValue(true)
    mockMasterchatStore.hasActionWithTime.calledWith(chatAction5.type, chatAction5.timestamp.getTime(), currentLivestreams[0].liveId).mockResolvedValue(true)

    await masterchatFetchService.initialise()

    expect(mockMasterchatStore.addMasterchatAction.mock.calls.length).toBe(0)
    expect(mockExternalRankEventService.onYoutubeChannelBanned.mock.calls.length).toBe(0)
    expect(mockExternalRankEventService.onYoutubeChannelUnbanned.mock.calls.length).toBe(0)
  })

  test('Processes remove chat item action', async () => {
    mockMasterchatService.fetch.calledWith(currentLivestreams[0].streamerId, currentLivestreams[0].continuationToken!).mockResolvedValue(createChatResponse(token2, [chatAction6]))

    await masterchatFetchService.initialise()

    const externalId = single2(mockChatService.onChatItemRemoved.mock.calls)
    expect(externalId).toBe(chatAction6.targetId)
  })
})

function createChatResponse (continuationToken: string, actions?: Action[]): ChatResponse {
  return {
    continuation: { token: continuationToken, timeoutMs: 10000 },
    error: null,
    actions: actions ?? []
  }
}
