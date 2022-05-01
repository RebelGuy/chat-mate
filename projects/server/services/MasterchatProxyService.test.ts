import { ChatResponse, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import { IMasterchat } from '@rebel/server/interfaces'
import LogService from '@rebel/server/services/LogService'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import StatusService from '@rebel/server/services/StatusService'
import { nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'
import MasterchatFactory from '@rebel/server/factories/MasterchatFactory'

let mockLogService: MockProxy<LogService>
let mockStatusService: MockProxy<StatusService>
let mockMasterchat: MockProxy<IMasterchat>
let masterchatProxyService: MasterchatProxyService

beforeEach(() => {
  mockLogService = mock<LogService>()
  mockStatusService = mock<StatusService>()
  mockMasterchat = mock<IMasterchat>()

  const mockMasterchatFactory = mock<MasterchatFactory>({
    create: () => mockMasterchat
  })

  masterchatProxyService = new MasterchatProxyService(new Dependencies({
    logService: mockLogService,
    masterchatStatusService: mockStatusService,
    masterchatFactory: mockMasterchatFactory
  }))
})

describe(nameof(MasterchatProxyService, 'fetch'), () => {
  test('successful request', async () => {
    const expectedResponse: ChatResponse = {} as any
    const token: string = 'test token'
    mockMasterchat.fetch.calledWith(token).mockResolvedValue(expectedResponse)

    // todo: need to add masterchat first before providing liveId. also test that there is an error when trying to operate on invalid id.
    const actualResponse = await masterchatProxyService.fetch(token)

    expect(actualResponse).toBe(expectedResponse)
    verifyServicesUsed(false)
  })

  test('failed request', async () => {
    const expectedResponse = new Error()
    const token: string = 'test token'
    mockMasterchat.fetch.calledWith(token).mockRejectedValue(expectedResponse)

    let actualResponse
    try {
      await masterchatProxyService.fetch(token)
    } catch (e: any) {
      actualResponse = e
    }

    expect(actualResponse).toBe(expectedResponse)
    verifyServicesUsed(true)
  })
})

describe(nameof(MasterchatProxyService, 'fetchMetadata'), () => {
  test('successful request', async () => {
    const expectedResponse: Metadata = {} as any
    mockMasterchat.fetchMetadata.calledWith().mockResolvedValue(expectedResponse)

    const actualResponse = await masterchatProxyService.fetchMetadata('todo')

    expect(actualResponse).toBe(expectedResponse)
    verifyServicesUsed(false)
  })

  test('failed request', async () => {
    const expectedResponse = new Error()
    mockMasterchat.fetchMetadata.calledWith().mockRejectedValue(expectedResponse)

    let actualResponse
    try {
      await masterchatProxyService.fetchMetadata('todo')
    } catch (e: any) {
      actualResponse = e
    }

    expect(actualResponse).toBe(expectedResponse)
    verifyServicesUsed(true)
  })
})

function verifyServicesUsed (expectError: boolean) {
  expect(mockLogService.logApiRequest.mock.calls.length).toBe(1)
  expect(mockLogService.logApiResponse.mock.calls.length).toBe(1)
  const loggedError = mockLogService.logApiResponse.mock.calls[0][2]
  expect(loggedError).toBe(expectError)

  const reportedStatus = mockStatusService.onRequestDone.mock.calls[0][1]
  expect(reportedStatus).toBe(expectError ? 'error' : 'ok')
}
