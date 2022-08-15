import { ChatResponse, Masterchat, Metadata } from '@rebel/masterchat'
import { YTAction } from '@rebel/masterchat/interfaces/yt/chat'
import { Dependencies } from '@rebel/server/context/context'
import { IMasterchat } from '@rebel/server/interfaces'
import LogService from '@rebel/server/services/LogService'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import StatusService from '@rebel/server/services/StatusService'
import { nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'
import MasterchatFactory from '@rebel/server/factories/MasterchatFactory'

const liveId = 'liveId'

let mockLogService: MockProxy<LogService>
let mockStatusService: MockProxy<StatusService>
let mockMasterchatFactory: MockProxy<MasterchatFactory>
let mockMasterchat: MockProxy<Masterchat>
let masterchatProxyService: MasterchatProxyService

beforeEach(() => {
  mockLogService = mock<LogService>()
  mockStatusService = mock<StatusService>()
  mockMasterchatFactory = mock<MasterchatFactory>()
  mockMasterchat = mock<Masterchat>()

  mockMasterchatFactory.create.calledWith(liveId).mockReturnValue(mockMasterchat)

  masterchatProxyService = new MasterchatProxyService(new Dependencies({
    logService: mockLogService,
    masterchatStatusService: mockStatusService,
    masterchatFactory: mockMasterchatFactory
  }))

  masterchatProxyService.addMasterchat(liveId)
})

describe(nameof(MasterchatProxyService, 'addMasterchat'), () => {
  test('creates masterchat instance with specified liveId', async () => {
    const testLiveId1 = 'testLiveId1'
    const testLiveId2 = 'testLiveId2'
    const testMasterchat1 = mock<Masterchat>()
    const testMasterchat2 = mock<Masterchat>()
    mockMasterchatFactory.create.mockClear()
    mockMasterchatFactory.create.calledWith(testLiveId1).mockReturnValue(testMasterchat1)
    mockMasterchatFactory.create.calledWith(testLiveId2).mockReturnValue(testMasterchat2)

    masterchatProxyService.addMasterchat(testLiveId1)
    masterchatProxyService.addMasterchat(testLiveId2)

    expect(mockMasterchatFactory.create.mock.calls).toEqual([[testLiveId1], [testLiveId2]])

    // new instances are usable
    const chatResponse1: ChatResponse = {} as any
    const chatResponse2: ChatResponse = {} as any
    testMasterchat1.fetch.mockResolvedValue(chatResponse1)
    testMasterchat2.fetch.mockResolvedValue(chatResponse2)
    
    const result1 = await masterchatProxyService.fetch(testLiveId1, undefined)
    const result2 = await masterchatProxyService.fetch(testLiveId2, undefined)

    expect(result1).toBe(chatResponse1)
    expect(result2).toBe(chatResponse2)
  })
})

describe(nameof(MasterchatProxyService, 'fetch'), () => {
  test('successful request', async () => {
    const expectedResponse: ChatResponse = {} as any
    const token: string = 'test token'
    mockMasterchat.fetch.calledWith(token).mockResolvedValue(expectedResponse)

    await testSuccessful(() => masterchatProxyService.fetch(liveId, token), expectedResponse)
  })

  test('failed request', async () => {
    const expectedResponse = new Error()
    const token: string = 'test token'
    mockMasterchat.fetch.calledWith(token).mockRejectedValue(expectedResponse)

    await testFailing(() => masterchatProxyService.fetch(liveId, token), expectedResponse)
  })

  test('throws if invalid liveId', async () => {
    await expect(masterchatProxyService.fetch('invalidId', undefined)).rejects.toThrow()
  })
})

describe(nameof(MasterchatProxyService, 'fetchMetadata'), () => {
  test('successful request', async () => {
    const expectedResponse: Metadata = {} as any
    mockMasterchat.fetchMetadata.calledWith().mockResolvedValue(expectedResponse)

    await testSuccessful(() => masterchatProxyService.fetchMetadata(liveId), expectedResponse)
  })

  test('failed request', async () => {
    const expectedResponse = new Error()
    mockMasterchat.fetchMetadata.calledWith().mockRejectedValue(expectedResponse)

    await testFailing(() => masterchatProxyService.fetchMetadata(liveId), expectedResponse)
  })
})

describe(nameof(MasterchatProxyService, 'banYoutubeChannel'), () => {
  test('successful request with user banned', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.hide.calledWith(contextMenuEndpointParams).mockResolvedValue([])

    await testSuccessful(() => masterchatProxyService.banYoutubeChannel(contextMenuEndpointParams), true)
  })

  test('successful request with user not banned', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.hide.calledWith(contextMenuEndpointParams).mockResolvedValue(null!)

    await testSuccessful(() => masterchatProxyService.banYoutubeChannel(contextMenuEndpointParams), false)
  })

  test('failed request', async () => {
    const contextMenuEndpointParams = 'test'
    const error = new Error()
    mockMasterchat.hide.calledWith(contextMenuEndpointParams).mockRejectedValue(error)

    await testFailing(() => masterchatProxyService.banYoutubeChannel(contextMenuEndpointParams), error)
  })
})

describe(nameof(MasterchatProxyService, 'timeout'), () => {
  test('successful request with user timed out', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.timeout.calledWith(contextMenuEndpointParams).mockResolvedValue([])

    await testSuccessful(() => masterchatProxyService.timeout(contextMenuEndpointParams), true)
  })

  test('successful request with user not timed out', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.timeout.calledWith(contextMenuEndpointParams).mockResolvedValue(null!)

    await testSuccessful(() => masterchatProxyService.timeout(contextMenuEndpointParams), false)
  })

  test('failed request', async () => {
    const contextMenuEndpointParams = 'test'
    const error = new Error()
    mockMasterchat.timeout.calledWith(contextMenuEndpointParams).mockRejectedValue(error)

    await testFailing(() => masterchatProxyService.timeout(contextMenuEndpointParams), error)
  })
})

describe(nameof(MasterchatProxyService, 'unbanYoutubeChannel'), () => {
  test('successful request with user unbanned', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.unhide.calledWith(contextMenuEndpointParams).mockResolvedValue([])

    await testSuccessful(() => masterchatProxyService.unbanYoutubeChannel(contextMenuEndpointParams), true)
  })

  test('successful request with user not unbanned', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.unhide.calledWith(contextMenuEndpointParams).mockResolvedValue(null!)

    await testSuccessful(() => masterchatProxyService.unbanYoutubeChannel(contextMenuEndpointParams), false)
  })

  test('failed request', async () => {
    const contextMenuEndpointParams = 'test'
    const error = new Error()
    mockMasterchat.unhide.calledWith(contextMenuEndpointParams).mockRejectedValue(error)

    await testFailing(() => masterchatProxyService.unbanYoutubeChannel(contextMenuEndpointParams), error)
  })

  test('throws if invalid liveId', async () => {
    await expect(masterchatProxyService.fetchMetadata('invalidId')).rejects.toThrow()
  })
})

describe(nameof(MasterchatProxyService, 'removeMasterchat'), () => {
  test('creates masterchat instance with specified liveId', async () => {
    masterchatProxyService.removeMasterchat(liveId)

    await expect(masterchatProxyService.fetch(liveId, undefined)).rejects.toThrow()
  })
})

describe(nameof(MasterchatProxyService, 'mod'), () => {
  test('successful request with user modded', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.addModerator.calledWith(contextMenuEndpointParams).mockResolvedValue([])

    await testSuccessful(() => masterchatProxyService.mod(contextMenuEndpointParams), true)
  })

  test('successful request with user not modded', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.addModerator.calledWith(contextMenuEndpointParams).mockResolvedValue(null!)

    await testSuccessful(() => masterchatProxyService.mod(contextMenuEndpointParams), false)
  })

  test('failed request', async () => {
    const contextMenuEndpointParams = 'test'
    const error = new Error()
    mockMasterchat.addModerator.calledWith(contextMenuEndpointParams).mockRejectedValue(error)

    await testFailing(() => masterchatProxyService.mod(contextMenuEndpointParams), error)
  })
})

describe(nameof(MasterchatProxyService, 'unmod'), () => {
  test('successful request with user unmodded', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.removeModerator.calledWith(contextMenuEndpointParams).mockResolvedValue([])

    await testSuccessful(() => masterchatProxyService.unmod(contextMenuEndpointParams), true)
  })

  test('successful request with user not unmodded', async () => {
    const contextMenuEndpointParams = 'test'
    mockMasterchat.removeModerator.calledWith(contextMenuEndpointParams).mockResolvedValue(null!)

    await testSuccessful(() => masterchatProxyService.unmod(contextMenuEndpointParams), false)
  })

  test('failed request', async () => {
    const contextMenuEndpointParams = 'test'
    const error = new Error()
    mockMasterchat.removeModerator.calledWith(contextMenuEndpointParams).mockRejectedValue(error)

    await testFailing(() => masterchatProxyService.unmod(contextMenuEndpointParams), error)
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
