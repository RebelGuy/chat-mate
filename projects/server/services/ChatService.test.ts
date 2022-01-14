import { Livestream } from '@prisma/client'
import { Action, AddChatItemAction, ChatResponse } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import { IMasterchat } from '@rebel/server/interfaces'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import ChatService from '@rebel/server/services/ChatService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import LogService from '@rebel/server/services/LogService'
import ChatStore from '@rebel/server/stores/ChatStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
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
let mockExperienceService: MockProxy<ExperienceService>
let mockViewershipStore: MockProxy<ViewershipStore>
let mockTimerHelpers: MockProxy<TimerHelpers>
let chatService: ChatService

beforeEach(() => {
  mockChatStore = mock<ChatStore>()
  mockLivestreamStore = mock<LivestreamStore>()
  mockMasterchat = mock<IMasterchat>()
  mockLogService = mock<LogService>()
  mockExperienceService = mock<ExperienceService>()
  mockViewershipStore = mock<ViewershipStore>()
  mockTimerHelpers = mock<TimerHelpers>()

  mockGetter(mockLivestreamStore, 'currentLivestream').mockReturnValue(currentLivestream)
  mockChatStore.getChatSince.mockResolvedValue([])

  // automatically execute callback passed to TimerHelpers
  mockTimerHelpers.createRepeatingTimer.mockImplementation(async (options, runImmediately) => {
    await options.callback()
  })

  const mockMasterchatProvider = mockDeep<MasterchatProvider>({
    get: () => mockMasterchat
  })

  chatService = new ChatService(new Dependencies({
    chatStore: mockChatStore,
    livestreamStore: mockLivestreamStore,
    logService: mockLogService,
    experienceService: mockExperienceService,
    viewershipStore: mockViewershipStore,
    masterchatProvider: mockMasterchatProvider,
    timerHelpers: mockTimerHelpers
  }))
})

describe(nameof(ChatService, 'start'), () => {
  test('throws when starting twice', async () => {
    mockMasterchat.fetch.mockResolvedValue(createChatResponse())

    await chatService.start()

    await expect(() => chatService.start()).rejects.toThrow()
  })

  test('uses continuation token when fetching and schedules new fetch', async () => {
    mockMasterchat.fetch.mockResolvedValue(createChatResponse())

    await chatService.start()

    // don't need to explicitly check return type of the callback because the type guard already checks this
    const expectedTimerOptions: TimerOptions = { behaviour: 'dynamicEnd', callback: expect.any(Function) }
    expect(single(mockTimerHelpers.createRepeatingTimer.mock.calls)).toEqual([expectedTimerOptions, true])

    expect(single(single(mockMasterchat.fetch.mock.calls))).toBe(token1)
  })

  test('quietly handles fetching error and reset continuation token', async () => {
    mockMasterchat.fetch.mockRejectedValue(new Error('Fetching failed'))

    await chatService.start()

    expect(single(single(mockLivestreamStore.setContinuationToken.mock.calls))).toBe(null)
  })

  test('passes chat items to ChatStore and ExperienceService', async () => {
    mockMasterchat.fetch.mockResolvedValue(createChatResponse([chatAction1]))

    await chatService.start()

    const [passedToken, passedChatItems] = single(mockChatStore.addChat.mock.calls)
    expect(passedToken).toBe(token2)
    expect(single(passedChatItems).id).toBe(chatAction1.id)

    const [passedChannel, passedTimestamp] = single(mockViewershipStore.addViewershipForChatParticipation.mock.calls)
    expect(passedChannel).toBe(chatAction1.authorChannelId)
    expect(passedTimestamp).toBe(chatAction1.timestamp.getTime())

    const [passedXpItems] = single(mockExperienceService.addExperienceForChat.mock.calls)
    expect(single(passedXpItems).id).toBe(chatAction1.id)
  })
})

function createChatResponse (actions?: AddChatItemAction[]): ChatResponse {
  return {
    continuation: { token: token2, timeoutMs: 10000 },
    error: null,
    actions: actions ?? []
  }
}