import { ChatResponse, Masterchat, Metadata } from '@rebel/masterchat'
import { YTAction } from '@rebel/masterchat/interfaces/yt/chat'
import { Dependencies } from '@rebel/server/context/context'
import { IMasterchat } from '@rebel/server/interfaces'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import LogService from '@rebel/server/services/LogService'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import StatusService from '@rebel/server/services/StatusService'
import { nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockLogService: MockProxy<LogService>
let mockStatusService: MockProxy<StatusService>
let mockMasterchat: MockProxy<Masterchat>
let masterchatProxyService: MasterchatProxyService

beforeEach(() => {
  mockLogService = mock<LogService>()
  mockStatusService = mock<StatusService>()
  mockMasterchat = mock<Masterchat>()

  const mockMasterchatProvider = mock<MasterchatProvider>({
    get: () => mockMasterchat
  })

  masterchatProxyService = new MasterchatProxyService(new Dependencies({
    logService: mockLogService,
    masterchatStatusService: mockStatusService,
    masterchatProvider: mockMasterchatProvider
  }))
})

describe(nameof(MasterchatProxyService, 'fetch'), () => {
  test('successful request', async () => {
    const expectedResponse: ChatResponse = {} as any
    const token: string = 'test token'
    mockMasterchat.fetch.calledWith(token).mockResolvedValue(expectedResponse)

    await testSuccessful(() => masterchatProxyService.fetch(token), expectedResponse)
  })

  test('failed request', async () => {
    const expectedResponse = new Error()
    const token: string = 'test token'
    mockMasterchat.fetch.calledWith(token).mockRejectedValue(expectedResponse)

    await testFailing(() => masterchatProxyService.fetch(token), expectedResponse)
  })
})

describe(nameof(MasterchatProxyService, 'fetchMetadata'), () => {
  test('successful request', async () => {
    const expectedResponse: Metadata = {} as any
    mockMasterchat.fetchMetadata.calledWith().mockResolvedValue(expectedResponse)

    await testSuccessful(() => masterchatProxyService.fetchMetadata(), expectedResponse)
  })

  test('failed request', async () => {
    const expectedResponse = new Error()
    mockMasterchat.fetchMetadata.calledWith().mockRejectedValue(expectedResponse)

    await testFailing(() => masterchatProxyService.fetchMetadata(), expectedResponse)
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
