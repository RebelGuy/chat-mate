import { YoutubeLivestream } from '@prisma/client'
import { Action, AddChatItemAction, ChatResponse, HideUserAction, MarkChatItemAsDeletedAction, UnhideUserAction, TimeoutUserAction, YTRun, LiveReactions } from '@rebel/masterchat'
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
import MasterchatStore from '@rebel/server/stores/MasterchatStore'
import ExternalRankEventService from '@rebel/server/services/rank/ExternalRankEventService'
import { single, single2 } from '@rebel/shared/util/arrays'
import CacheService from '@rebel/server/services/CacheService'
import EmojiService from '@rebel/server/services/EmojiService'
import LiveReactionService from '@rebel/server/services/LiveReactionService'

// jest is having trouble mocking the correct overload method, so we have to force it into the correct type
type CreateRepeatingTimer = CalledWithMock<Promise<number>, [TimerOptions, true]>

const token1 = 'token1'
const token2 = 'token2'
const token3 = 'token3'
const token4 = 'token4'
const streamer1 = 1
const streamer2 = 2
const currentLivestreams: YoutubeLivestream[] = [{
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
const chatAction6 = cast<TimeoutUserAction>({
  type: 'timeoutUserAction',
  timestamp: data.time3,
  timestampUsec: `${data.time3.getTime() * 1000}`,
  moderatorChannelName: 'modName3',
  userChannelName: 'userName3',
  durationSeconds: 100
})
const chatAction7 = cast<MarkChatItemAsDeletedAction>({
  type: 'markChatItemAsDeletedAction',
  targetId: 'externalId'
})

let mockChatStore: MockProxy<ChatStore>
let mockLivestreamStore: MockProxy<LivestreamStore>
let mockMasterchatService: MockProxy<MasterchatService>
let mockLogService: MockProxy<LogService>
let mockTimerHelpers: MockProxy<TimerHelpers>
let mockChatService: MockProxy<ChatService>
let mockMasterchatStore: MockProxy<MasterchatStore>
let mockExternalRankEventService: MockProxy<ExternalRankEventService>
let mockCacheService: MockProxy<CacheService>
let mockEmojiService: MockProxy<EmojiService>
let mockLiveReactionService: MockProxy<LiveReactionService>
let masterchatFetchService: MasterchatFetchService

beforeEach(() => {
  mockChatStore = mock()
  mockLivestreamStore = mock()
  mockMasterchatService = mock()
  mockLogService = mock()
  mockTimerHelpers = mock()
  mockChatService = mock()
  mockMasterchatStore = mock()
  mockExternalRankEventService = mock()
  mockCacheService = mock()
  mockEmojiService = mock()
  mockLiveReactionService = mock()

  mockLivestreamStore.getActiveYoutubeLivestreams.calledWith().mockResolvedValue(currentLivestreams)
  mockChatStore.getChatSince.calledWith(expect.any(Number), expect.any(Number), undefined, undefined).mockResolvedValue([])
  mockLivestreamStore.getActiveYoutubeLivestream.mockImplementation(streamerId => Promise.resolve(currentLivestreams.find(l => l.streamerId === streamerId)!))

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
    masterchatStore: mockMasterchatStore,
    externalRankEventService: mockExternalRankEventService,
    cacheService: mockCacheService,
    emojiService: mockEmojiService,
    liveReactionService: mockLiveReactionService,
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
      masterchatStore: mockMasterchatStore,
      externalRankEventService: mockExternalRankEventService,
      cacheService: mockCacheService,
      emojiService: mockEmojiService,
      liveReactionService: mockLiveReactionService,
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

    const calls = mockLivestreamStore.setYoutubeContinuationToken.mock.calls
    expect(calls.length).toBe(2)
    expect(calls).toEqual(expectArray<[liveId: string, continuationToken: string | null]>([
      [currentLivestreams[0].liveId, null],
      [currentLivestreams[1].liveId, token4]
    ]))
  })

  test('Quietly handles no active livestream', async () => {
    mockLivestreamStore.getActiveYoutubeLivestreams.calledWith().mockResolvedValue([])

    await masterchatFetchService.initialise()

    expect(mockLivestreamStore.setYoutubeContinuationToken.mock.calls.length).toBe(0)
    expect(mockTimerHelpers.dispose.mock.calls.length).toBe(0)
  })

  test('Passes ordered chat items to ChatService and updates continuation token', async () => {
    mockMasterchatService.fetch.calledWith(currentLivestreams[0].streamerId, currentLivestreams[0].continuationToken!).mockResolvedValue(createChatResponse(token2, [chatAction2, chatAction1]))
    mockMasterchatService.fetch.calledWith(currentLivestreams[1].streamerId, currentLivestreams[1].continuationToken!).mockResolvedValue(createChatResponse(token4, [chatAction3]))
    mockChatService.onNewChatItem.calledWith(expect.anything(), expect.anything()).mockResolvedValue(true)
    mockEmojiService.analyseYoutubeTextForEmojis.mockImplementation(run => [run])

    await masterchatFetchService.initialise()

    const chatServiceCalls = mockChatService.onNewChatItem.mock.calls
    expect(chatServiceCalls.length).toBe(3)
    // we can't be sure of the order, due to the async nature of the implementation
    expect(chatServiceCalls).toEqual(expectArray<[item: ChatItem, streamerId: number]>([
      [expectObject<ChatItem>({ id: chatAction1.id }), streamer1],
      [expectObject<ChatItem>({ id: chatAction2.id }), streamer1],
      [expectObject<ChatItem>({ id: chatAction3.id }), streamer2]
    ]))

    const livestreamStoreCalls = mockLivestreamStore.setYoutubeContinuationToken.mock.calls
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
    mockEmojiService.analyseYoutubeTextForEmojis.mockImplementation(run => [run])

    await masterchatFetchService.initialise()

    const continuationTokenCalls = mockLivestreamStore.setYoutubeContinuationToken.mock.calls
    expect(continuationTokenCalls).toEqual<typeof continuationTokenCalls>([
      [currentLivestreams[0].liveId, token2],
      [currentLivestreams[1].liveId, token4]
    ])
  })

  test('Persists hide/unhide/timeout user actions and notifies service', async () => {
    mockMasterchatService.fetch.calledWith(currentLivestreams[0].streamerId, currentLivestreams[0].continuationToken!).mockResolvedValue(createChatResponse(token2, [chatAction4, chatAction5, chatAction6]))
    mockMasterchatStore.hasActionWithTime.calledWith(chatAction4.type, chatAction4.timestamp.getTime(), currentLivestreams[0].liveId).mockResolvedValue(false)
    mockMasterchatStore.hasActionWithTime.calledWith(chatAction5.type, chatAction5.timestamp.getTime(), currentLivestreams[0].liveId).mockResolvedValue(false)
    mockMasterchatStore.hasActionWithTime.calledWith(chatAction6.type, chatAction6.timestamp.getTime(), currentLivestreams[0].liveId).mockResolvedValue(false)

    await masterchatFetchService.initialise()

    const [addCall1, addCall2, addCall3] = mockMasterchatStore.addMasterchatAction.mock.calls
    expect(addCall1).toEqual<typeof addCall1>([chatAction4.type, JSON.stringify(chatAction4), chatAction4.timestamp.getTime(), currentLivestreams[0].liveId])
    expect(addCall2).toEqual<typeof addCall1>([chatAction5.type, JSON.stringify(chatAction5), chatAction5.timestamp.getTime(), currentLivestreams[0].liveId])
    expect(addCall3).toEqual<typeof addCall1>([chatAction6.type, JSON.stringify(chatAction6), chatAction6.timestamp.getTime(), currentLivestreams[0].liveId])

    const banCall = single(mockExternalRankEventService.onYoutubeChannelBanned.mock.calls)
    expect(banCall).toEqual<typeof banCall>([currentLivestreams[0].streamerId, chatAction4.userChannelName, chatAction4.moderatorChannelName])

    const unbanCall = single(mockExternalRankEventService.onYoutubeChannelUnbanned.mock.calls)
    expect(unbanCall).toEqual<typeof unbanCall>([currentLivestreams[0].streamerId, chatAction5.userChannelName, chatAction5.moderatorChannelName])

    const timeoutCall = single(mockExternalRankEventService.onYoutubeChannelTimedOut.mock.calls)
    expect(timeoutCall).toEqual<typeof timeoutCall>([currentLivestreams[0].streamerId, chatAction6.userChannelName, chatAction6.moderatorChannelName, chatAction6.durationSeconds])
  })

  test('Does not process hide/unhide/timeout action if already exists', async () => {
    mockMasterchatService.fetch.calledWith(currentLivestreams[0].streamerId, currentLivestreams[0].continuationToken!).mockResolvedValue(createChatResponse(token2, [chatAction4, chatAction5, chatAction6]))
    mockMasterchatStore.hasActionWithTime.calledWith(chatAction4.type, chatAction4.timestamp.getTime(), currentLivestreams[0].liveId).mockResolvedValue(true)
    mockMasterchatStore.hasActionWithTime.calledWith(chatAction5.type, chatAction5.timestamp.getTime(), currentLivestreams[0].liveId).mockResolvedValue(true)
    mockMasterchatStore.hasActionWithTime.calledWith(chatAction6.type, chatAction6.timestamp.getTime(), currentLivestreams[0].liveId).mockResolvedValue(true)

    await masterchatFetchService.initialise()

    expect(mockMasterchatStore.addMasterchatAction.mock.calls.length).toBe(0)
    expect(mockExternalRankEventService.onYoutubeChannelBanned.mock.calls.length).toBe(0)
    expect(mockExternalRankEventService.onYoutubeChannelUnbanned.mock.calls.length).toBe(0)
    expect(mockExternalRankEventService.onYoutubeChannelTimedOut.mock.calls.length).toBe(0)
  })

  test('Processes remove chat item action', async () => {
    mockMasterchatService.fetch.calledWith(currentLivestreams[0].streamerId, currentLivestreams[0].continuationToken!).mockResolvedValue(createChatResponse(token2, [chatAction7]))

    await masterchatFetchService.initialise()

    const externalId = single2(mockChatService.onChatItemDeleted.mock.calls)
    expect(externalId).toBe(chatAction7.targetId)
  })

  test('Processes live reactions', async () => {
    const unicodeEmoji1 = 'emoji1'
    const unicodeEmoji2 = 'emoji2'
    const liveReactions: LiveReactions = { [unicodeEmoji1]: 1, [unicodeEmoji2]: 2 }

    mockMasterchatService.fetch.calledWith(currentLivestreams[0].streamerId, currentLivestreams[0].continuationToken!).mockResolvedValue(createChatResponse(token2, [], liveReactions))

    await masterchatFetchService.initialise()

    const calls = mockLiveReactionService.onLiveReaction.mock.calls
    expect(calls).toEqual(expectArray(calls, [
      [currentLivestreams[0].streamerId, unicodeEmoji1, liveReactions[unicodeEmoji1]],
      [currentLivestreams[0].streamerId, unicodeEmoji2, liveReactions[unicodeEmoji2]]
    ]))
  })
})

function createChatResponse (continuationToken: string, actions?: Action[], liveReactions?: LiveReactions): ChatResponse {
  return {
    continuation: { token: continuationToken, timeoutMs: 10000 },
    reactions: liveReactions ?? {},
    error: null,
    actions: actions ?? []
  }
}
