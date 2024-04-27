import { ActionCatalog, ChatResponse, Masterchat, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/shared/context/context'
import LogService from '@rebel/server/services/LogService'
import MasterchatService, { MasterchatAuthentication } from '@rebel/server/services/MasterchatService'
import StatusService from '@rebel/server/services/StatusService'
import { cast, mockGetter, nameof } from '@rebel/shared/testUtils'
import { any, mock, MockProxy } from 'jest-mock-extended'
import MasterchatFactory from '@rebel/server/factories/MasterchatFactory'
import ChatStore from '@rebel/server/stores/ChatStore'
import { ChatMateError, NoContextTokenError, NoYoutubeChatMessagesError } from '@rebel/shared/util/error'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import PlatformApiStore from '@rebel/server/stores/PlatformApiStore'
import AuthStore from '@rebel/server/stores/AuthStore'
import * as data from '@rebel/server/_test/testData'
import { YoutubeWebAuth } from '@prisma/client'
import { single2 } from '@rebel/shared/util/arrays'

const liveId = 'liveId'
const streamerId = 10000
const mockChannelId = 'mockChannelId'

let mockLogService: MockProxy<LogService>
let mockStatusService: MockProxy<StatusService>
let mockMasterchatFactory: MockProxy<MasterchatFactory>
let mockMasterchat: MockProxy<Masterchat>
let mockChatStore: MockProxy<ChatStore>
let mockPlatformApiStore: MockProxy<PlatformApiStore>
let mockAuthStore: MockProxy<AuthStore>
let masterchatService: MasterchatService

beforeEach(async () => {
  mockLogService = mock()
  mockStatusService = mock()
  mockMasterchatFactory = mock()
  mockMasterchat = mock()
  mockChatStore = mock()
  mockPlatformApiStore = mock()
  mockAuthStore = mock()

  mockMasterchatFactory.create.calledWith(liveId).mockResolvedValue(mockMasterchat)

  masterchatService = new MasterchatService(new Dependencies({
    logService: mockLogService,
    masterchatStatusService: mockStatusService,
    masterchatFactory: mockMasterchatFactory,
    chatStore: mockChatStore,
    platformApiStore: mockPlatformApiStore,
    authStore: mockAuthStore,
    channelId: mockChannelId
  }))

  await masterchatService.addMasterchat(streamerId, liveId)
})

describe(nameof(MasterchatService, 'addMasterchat'), () => {
  test('Throws if attempting to add an instance for an existing streamer', async () => {
    await expect(() => masterchatService.addMasterchat(streamerId, liveId)).rejects.toThrowError(ChatMateError)
  })

  test('creates masterchat instance with specified liveId', async () => {
    const testLiveId1 = 'testLiveId1'
    const testLiveId2 = 'testLiveId2'
    const streamer1 = 1
    const streamer2 = 2
    const testMasterchat1 = mock<Masterchat>()
    const testMasterchat2 = mock<Masterchat>()
    mockMasterchatFactory.create.mockReset()
    mockMasterchatFactory.create.calledWith(testLiveId1).mockResolvedValue(testMasterchat1)
    mockMasterchatFactory.create.calledWith(testLiveId2).mockResolvedValue(testMasterchat2)

    await masterchatService.addMasterchat(streamer1, testLiveId1)
    await masterchatService.addMasterchat(streamer2, testLiveId2)

    expect(mockMasterchatFactory.create.mock.calls).toEqual([[testLiveId1], [testLiveId2]])

    // new instances are usable
    const chatResponse1: ChatResponse = {} as any
    const chatResponse2: ChatResponse = {} as any
    testMasterchat1.fetch.mockResolvedValue(chatResponse1)
    testMasterchat2.fetch.mockResolvedValue(chatResponse2)

    const result1 = await masterchatService.fetch(streamer1, undefined)
    const result2 = await masterchatService.fetch(streamer2, undefined)

    expect(result1).toBe(chatResponse1)
    expect(result2).toBe(chatResponse2)
  })
})

describe(nameof(MasterchatService, 'fetch'), () => {
  test('successful request', async () => {
    const expectedResponse: ChatResponse = {} as any
    const token: string = 'test token'
    mockMasterchat.fetch.calledWith(token).mockResolvedValue(expectedResponse)

    await testSuccessful(() => masterchatService.fetch(streamerId, token), expectedResponse)
  })

  test('failed request', async () => {
    const expectedResponse = new Error()
    const token: string = 'test token'
    mockMasterchat.fetch.calledWith(token).mockRejectedValue(expectedResponse)

    await testFailing(() => masterchatService.fetch(streamerId, token), expectedResponse)
  })

  test('throws if invalid liveId', async () => {
    await expect(masterchatService.fetch(150, undefined)).rejects.toThrowError(ChatMateError)
  })
})

describe(nameof(MasterchatService, 'fetchMetadata'), () => {
  test('successful request', async () => {
    const expectedResponse: Metadata = {} as any
    mockMasterchat.fetchMetadata.calledWith().mockResolvedValue(expectedResponse)

    await testSuccessful(() => masterchatService.fetchMetadata(streamerId), expectedResponse)
  })

  test('failed request', async () => {
    const expectedResponse = new Error()
    mockMasterchat.fetchMetadata.calledWith().mockRejectedValue(expectedResponse)

    await testFailing(() => masterchatService.fetchMetadata(streamerId), expectedResponse)
  })
})

describe(nameof(MasterchatService, 'getChannelIdFromAnyLiveId'), () => {
  test('Gets the channel ID from the livestream', async () => {
    const youtubeId = 'testYoutubeId'
    mockMasterchat.fetchMetadata.calledWith().mockResolvedValue(cast<Metadata>({ channelId: youtubeId }))

    const result = await masterchatService.getChannelIdFromAnyLiveId(liveId)

    expect(result).toBe(youtubeId)
  })
})

describe(nameof(MasterchatService, 'getChatMateModeratorStatus'), () => {
  test('Returns true if the action catalog for the last chat message contains moderator actions', async () => {
    const time = new Date()
    const contextToken = 'contextToken'
    const lastMessage = cast<ChatItemWithRelations>({ contextToken, time })
    mockChatStore.getLastYoutubeChat.calledWith(streamerId).mockResolvedValue(lastMessage)
    mockMasterchatFactory.create.calledWith(any()).mockResolvedValue(mockMasterchat)
    mockMasterchat.getActionCatalog.calledWith(contextToken).mockResolvedValue(cast<ActionCatalog>({ pin: {} }))

    const result = await masterchatService.getChatMateModeratorStatus(streamerId)

    expect(result).toEqual<typeof result>({ isModerator: true, time: time.getTime() })
  })

  test('Returns false if the action catalog for the last chat message does not contain moderator actions', async () => {
    const time = new Date()
    const contextToken = 'contextToken'
    const lastMessage = cast<ChatItemWithRelations>({ contextToken, time })
    mockChatStore.getLastYoutubeChat.calledWith(streamerId).mockResolvedValue(lastMessage)
    mockMasterchatFactory.create.calledWith(any()).mockResolvedValue(mockMasterchat)
    mockMasterchat.getActionCatalog.calledWith(contextToken).mockResolvedValue(cast<ActionCatalog>({ block: {} }))

    const result = await masterchatService.getChatMateModeratorStatus(streamerId)

    expect(result).toEqual<typeof result>({ isModerator: false, time: time.getTime() })
  })

  test(`Throws ${NoYoutubeChatMessagesError.name} if no chat messages have been found for the given streamer`, async () => {
    mockChatStore.getLastYoutubeChat.calledWith(streamerId).mockResolvedValue(null)

    await expect(() => masterchatService.getChatMateModeratorStatus(streamerId)).rejects.toThrow(NoYoutubeChatMessagesError)
  })

  test(`Throws ${NoContextTokenError.name} if no context token was attached to the last chat message`, async () => {
    const lastMessage = cast<ChatItemWithRelations>({ contextToken: null })
    mockChatStore.getLastYoutubeChat.calledWith(streamerId).mockResolvedValue(lastMessage)

    await expect(() => masterchatService.getChatMateModeratorStatus(streamerId)).rejects.toThrow(NoContextTokenError)
  })
})

describe(nameof(MasterchatService, 'banYoutubeChannel'), () => {
  test('successful request with user banned', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.hide.calledWith(contextMenuEndpointParams).mockResolvedValue([])

    await testSuccessful(() => masterchatService.banYoutubeChannel(streamerId, contextMenuEndpointParams), true)
  })

  test('successful request with user not banned', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.hide.calledWith(contextMenuEndpointParams).mockResolvedValue(null!)

    await testSuccessful(() => masterchatService.banYoutubeChannel(streamerId, contextMenuEndpointParams), false)
  })

  test('failed request', async () => {
    const contextMenuEndpointParams = 'test'
    const error = new Error()
    mockMasterchat.hide.calledWith(contextMenuEndpointParams).mockRejectedValue(error)

    await testFailing(() => masterchatService.banYoutubeChannel(streamerId, contextMenuEndpointParams), error)
  })
})

describe(nameof(MasterchatService, 'timeout'), () => {
  test('successful request with user timed out', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.timeout.calledWith(contextMenuEndpointParams).mockResolvedValue([])

    await testSuccessful(() => masterchatService.timeout(streamerId, contextMenuEndpointParams), true)
  })

  test('successful request with user not timed out', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.timeout.calledWith(contextMenuEndpointParams).mockResolvedValue(null!)

    await testSuccessful(() => masterchatService.timeout(streamerId, contextMenuEndpointParams), false)
  })

  test('failed request', async () => {
    const contextMenuEndpointParams = 'test'
    const error = new Error()
    mockMasterchat.timeout.calledWith(contextMenuEndpointParams).mockRejectedValue(error)

    await testFailing(() => masterchatService.timeout(streamerId, contextMenuEndpointParams), error)
  })
})

describe(nameof(MasterchatService, 'unbanYoutubeChannel'), () => {
  test('successful request with user unbanned', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.unhide.calledWith(contextMenuEndpointParams).mockResolvedValue([])

    await testSuccessful(() => masterchatService.unbanYoutubeChannel(streamerId, contextMenuEndpointParams), true)
  })

  test('successful request with user not unbanned', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.unhide.calledWith(contextMenuEndpointParams).mockResolvedValue(null!)

    await testSuccessful(() => masterchatService.unbanYoutubeChannel(streamerId, contextMenuEndpointParams), false)
  })

  test('failed request', async () => {
    const contextMenuEndpointParams = 'test'
    const error = new Error()
    mockMasterchat.unhide.calledWith(contextMenuEndpointParams).mockRejectedValue(error)

    await testFailing(() => masterchatService.unbanYoutubeChannel(streamerId, contextMenuEndpointParams), error)
  })

  test('throws if invalid liveId', async () => {
    await expect(masterchatService.fetchMetadata(123456)).rejects.toThrowError(ChatMateError)
  })
})

describe(nameof(MasterchatService, 'removeMasterchat'), () => {
  test('removes masterchat instance with specified liveId', async () => {
    masterchatService.removeMasterchat(streamerId)

    await expect(masterchatService.fetch(streamerId, undefined)).rejects.toThrowError(ChatMateError)
  })
})

describe(nameof(MasterchatService, 'checkAuthentication'), () => {
  test('Returns null if no access token exists', async () => {
    masterchatService.removeMasterchat(streamerId)
    mockAuthStore.loadYoutubeWebAccessToken.calledWith(mockChannelId).mockResolvedValue(null)

    const result = await masterchatService.checkAuthentication()

    expect(result).toBeNull()
  })

  test('Returns data with inactive authentication if masterchat instance is logged out', async () => {
    const lastUpdated = data.time2
    mockGetter(mockMasterchat, 'isLoggedOut').mockReturnValue(true)
    mockAuthStore.loadYoutubeWebAccessToken.calledWith(mockChannelId).mockResolvedValue(cast<YoutubeWebAuth>({ updateTime: lastUpdated }))

    const result = await masterchatService.checkAuthentication()

    expect(result).toEqual<MasterchatAuthentication>({ isActive: false, lastUpdated: lastUpdated })
  })

  test('Returns data with active authentication if masterchat instance is logged in', async () => {
    const lastUpdated = data.time2
    mockGetter(mockMasterchat, 'isLoggedOut').mockReturnValue(false)
    mockAuthStore.loadYoutubeWebAccessToken.calledWith(mockChannelId).mockResolvedValue(cast<YoutubeWebAuth>({ updateTime: lastUpdated }))

    const result = await masterchatService.checkAuthentication()

    expect(result).toEqual<MasterchatAuthentication>({ isActive: true, lastUpdated: lastUpdated })
  })
})

describe(nameof(MasterchatService, 'mod'), () => {
  test('successful request with user modded', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.addModerator.calledWith(contextMenuEndpointParams).mockResolvedValue([])

    await testSuccessful(() => masterchatService.mod(streamerId, contextMenuEndpointParams), true)
  })

  test('successful request with user not modded', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.addModerator.calledWith(contextMenuEndpointParams).mockResolvedValue(null!)

    await testSuccessful(() => masterchatService.mod(streamerId, contextMenuEndpointParams), false)
  })

  test('failed request', async () => {
    const contextMenuEndpointParams = 'test'
    const error = new Error()
    mockMasterchat.addModerator.calledWith(contextMenuEndpointParams).mockRejectedValue(error)

    await testFailing(() => masterchatService.mod(streamerId, contextMenuEndpointParams), error)
  })
})

describe(nameof(MasterchatService, 'unmod'), () => {
  test('successful request with user unmodded', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.removeModerator.calledWith(contextMenuEndpointParams).mockResolvedValue([])

    await testSuccessful(() => masterchatService.unmod(streamerId, contextMenuEndpointParams), true)
  })

  test('successful request with user not unmodded', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.removeModerator.calledWith(contextMenuEndpointParams).mockResolvedValue(null!)

    await testSuccessful(() => masterchatService.unmod(streamerId, contextMenuEndpointParams), false)
  })

  test('failed request', async () => {
    const contextMenuEndpointParams = 'test'
    const error = new Error()
    mockMasterchat.removeModerator.calledWith(contextMenuEndpointParams).mockRejectedValue(error)

    await testFailing(() => masterchatService.unmod(streamerId, contextMenuEndpointParams), error)
  })
})

describe(nameof(MasterchatService, 'onAuthRefreshed'), () => {
  test('Updates the credentials of each active masterchat instance', async () => {
    const accessToken = 'accessToken'
    mockAuthStore.loadYoutubeWebAccessToken.calledWith(mockChannelId).mockResolvedValue(cast<YoutubeWebAuth>({ accessToken }))

    const streamer1 = 1
    const streamer2 = 2
    const testLiveId1 = 'testLiveId1'
    const testLiveId2 = 'testLiveId2'
    const testMasterchat1 = mock<Masterchat>()
    const testMasterchat2 = mock<Masterchat>()
    mockMasterchatFactory.create.mockReset()
    mockMasterchatFactory.create.calledWith(testLiveId1).mockResolvedValue(testMasterchat1)
    mockMasterchatFactory.create.calledWith(testLiveId2).mockResolvedValue(testMasterchat2)

    await masterchatService.addMasterchat(streamer1, testLiveId1)
    await masterchatService.addMasterchat(streamer2, testLiveId2)

    await masterchatService.onAuthRefreshed()

    expect(single2(testMasterchat1.setCredentials.mock.calls)).toBe(accessToken)
    expect(single2(testMasterchat2.setCredentials.mock.calls)).toBe(accessToken)
  })

  test('Throws if the authentication does not exist', async () => {
    mockAuthStore.loadYoutubeWebAccessToken.calledWith(mockChannelId).mockResolvedValue(null)

    await expect(() => masterchatService.onAuthRefreshed()).rejects.toThrowError(ChatMateError)
  })
})

async function testSuccessful (request: () => Promise<any>, expected: any) {
  const actualResponse = await request()

  expect(actualResponse).toBe(expected)
  verifyServicesUsed(false)
}

async function testFailing (request: () => Promise<any>, expected: any) {
  let actualResponse
  try {
    await request()
  } catch (e: any) {
    actualResponse = e
  }

  expect(actualResponse).toBe(expected)
  verifyServicesUsed(true)
}

function verifyServicesUsed (expectError: boolean) {
  expect(mockLogService.logApiRequest.mock.calls.length).toBe(1)
  expect(mockLogService.logApiResponse.mock.calls.length).toBe(1)
  const loggedError = mockLogService.logApiResponse.mock.calls[0][2]
  expect(loggedError).toBe(expectError)

  const reportedStatus = mockStatusService.onRequestDone.mock.calls[0][1]
  expect(reportedStatus).toBe(expectError ? 'error' : 'ok')
}
