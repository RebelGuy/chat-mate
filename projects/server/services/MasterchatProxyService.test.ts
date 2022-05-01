import { ChatResponse, Metadata } from '@rebel/masterchat'
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
let mockMasterchat: MockProxy<IMasterchat>
let masterchatProxyService: MasterchatProxyService

beforeEach(() => {
  mockLogService = mock<LogService>()
  mockStatusService = mock<StatusService>()
  mockMasterchatFactory = mock<MasterchatFactory>()
  mockMasterchat = mock<IMasterchat>()

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
    const testMasterchat1 = mock<IMasterchat>()
    const testMasterchat2 = mock<IMasterchat>()
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
    
    const result1 = await masterchatProxyService.fetch(testLiveId1)
    const result2 = await masterchatProxyService.fetch(testLiveId2)

    expect(result1).toBe(chatResponse1)
    expect(result2).toBe(chatResponse2)
  })
})

describe(nameof(MasterchatProxyService, 'fetch'), () => {
  test('successful request', async () => {
    const expectedResponse: ChatResponse = {} as any
    const token: string = 'test token'
    mockMasterchat.fetch.calledWith(token).mockResolvedValue(expectedResponse)

    const actualResponse = await masterchatProxyService.fetch(liveId, token)

    expect(actualResponse).toBe(expectedResponse)
    verifyServicesUsed(false)
  })

  test('failed request', async () => {
    const expectedResponse = new Error()
    const token: string = 'test token'
    mockMasterchat.fetch.calledWith(token).mockRejectedValue(expectedResponse)

    let actualResponse
    try {
      await masterchatProxyService.fetch(liveId, token)
    } catch (e: any) {
      actualResponse = e
    }

    expect(actualResponse).toBe(expectedResponse)
    verifyServicesUsed(true)
  })

  test('throws if invalid liveId', async () => {
    await expect(masterchatProxyService.fetch('invalidId')).rejects.toThrow()
  })
})

describe(nameof(MasterchatProxyService, 'fetchMetadata'), () => {
  test('successful request', async () => {
    const expectedResponse: Metadata = {} as any
    mockMasterchat.fetchMetadata.calledWith().mockResolvedValue(expectedResponse)

    const actualResponse = await masterchatProxyService.fetchMetadata(liveId)

    expect(actualResponse).toBe(expectedResponse)
    verifyServicesUsed(false)
  })

  test('failed request', async () => {
    const expectedResponse = new Error()
    mockMasterchat.fetchMetadata.calledWith().mockRejectedValue(expectedResponse)

    let actualResponse
    try {
      await masterchatProxyService.fetchMetadata(liveId)
    } catch (e: any) {
      actualResponse = e
    }

    expect(actualResponse).toBe(expectedResponse)
    verifyServicesUsed(true)
  })

  test('throws if invalid liveId', async () => {
    await expect(masterchatProxyService.fetchMetadata('invalidId')).rejects.toThrow()
  })
})

describe(nameof(MasterchatProxyService, 'removeMasterchat'), () => {
  test('creates masterchat instance with specified liveId', async () => {
    masterchatProxyService.removeMasterchat(liveId)

    await expect(masterchatProxyService.fetch(liveId)).rejects.toThrow()
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
