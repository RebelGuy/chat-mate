import { ChatResponse, FetchChatOptions, Masterchat, Metadata } from '@rebel/masterchat'
import { YTAction } from '@rebel/masterchat/interfaces/yt/chat'
import { Dependencies } from '@rebel/shared/context/context'
import { IMasterchat } from '@rebel/server/interfaces'
import LogService from '@rebel/server/services/LogService'
import MasterchatService from '@rebel/server/services/MasterchatService'
import StatusService from '@rebel/server/services/StatusService'
import { cast, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'
import MasterchatFactory from '@rebel/server/factories/MasterchatFactory'

const liveId = 'liveId'
const streamerId = 0

let mockLogService: MockProxy<LogService>
let mockStatusService: MockProxy<StatusService>
let mockMasterchatFactory: MockProxy<MasterchatFactory>
let mockMasterchat: MockProxy<Masterchat>
let masterchatService: MasterchatService

beforeEach(() => {
  mockLogService = mock<LogService>()
  mockStatusService = mock<StatusService>()
  mockMasterchatFactory = mock<MasterchatFactory>()
  mockMasterchat = mock<Masterchat>()

  mockMasterchatFactory.create.calledWith(liveId).mockReturnValue(mockMasterchat)

  masterchatService = new MasterchatService(new Dependencies({
    logService: mockLogService,
    masterchatStatusService: mockStatusService,
    masterchatFactory: mockMasterchatFactory
  }))

  masterchatService.addMasterchat(streamerId, liveId)
})

describe(nameof(MasterchatService, 'addMasterchat'), () => {
  test('Throws if attempting to add an instance for an existing streamer', () => {
    expect(() => masterchatService.addMasterchat(streamerId, liveId)).toThrow()
  })

  test('creates masterchat instance with specified liveId', async () => {
    const testLiveId1 = 'testLiveId1'
    const testLiveId2 = 'testLiveId2'
    const streamer1 = 1
    const streamer2 = 2
    const testMasterchat1 = mock<Masterchat>()
    const testMasterchat2 = mock<Masterchat>()
    mockMasterchatFactory.create.mockClear()
    mockMasterchatFactory.create.calledWith(testLiveId1).mockReturnValue(testMasterchat1)
    mockMasterchatFactory.create.calledWith(testLiveId2).mockReturnValue(testMasterchat2)

    masterchatService.addMasterchat(streamer1, testLiveId1)
    masterchatService.addMasterchat(streamer2, testLiveId2)

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
    await expect(masterchatService.fetch(150, undefined)).rejects.toThrow()
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
    await expect(masterchatService.fetchMetadata(123456)).rejects.toThrow()
  })
})

describe(nameof(MasterchatService, 'removeMasterchat'), () => {
  test('creates masterchat instance with specified liveId', async () => {
    masterchatService.removeMasterchat(streamerId)

    await expect(masterchatService.fetch(streamerId, undefined)).rejects.toThrow()
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
