import { Dependencies } from '@rebel/server/context/context'
import { TwitchMetadata } from '@rebel/server/interfaces'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import { nameof } from '@rebel/server/_test/utils'
import { HelixStream } from '@twurple/api/lib/api/helix/stream/HelixStream'
import { ApiClient } from '@twurple/api'
import { DeepMockProxy, mock, MockProxy } from 'jest-mock-extended'

const twitchChannelName = 'test_channel'
let mockLogService: MockProxy<LogService>
let mockStatusService: MockProxy<StatusService>
let twurpleApiProxyService: TwurpleApiProxyService
let mockApiClient: DeepMockProxy<ApiClient>

beforeEach(() => {
  mockLogService = mock()
  mockStatusService = mock()
  mockApiClient = mock()
  mockApiClient = mock({ streams: mock() }) as any // the compiler wants us to mock every property individually?
  const mockTwurpleApiClientProvider = mock<TwurpleApiClientProvider>({ get: () => mockApiClient })

  twurpleApiProxyService = new TwurpleApiProxyService(new Dependencies({
    logService: mockLogService,
    twitchChannelName: twitchChannelName,
    twurpleApiClientProvider: mockTwurpleApiClientProvider,
    twurpleStatusService: mockStatusService
  }))
  twurpleApiProxyService.initialise()
})

// this test mirrors the MasterchatProxyService tests implementation
describe(nameof(TwurpleApiProxyService, 'fetchMetadata'), () => {
  test('successful request', async () => {
    const mockedResponse: HelixStream = new HelixStream({ viewer_count: 10 } as any, mockApiClient)
    mockApiClient.streams.getStreamByUserName.calledWith(twitchChannelName).mockResolvedValue(mockedResponse)

    const metadata = await twurpleApiProxyService.fetchMetadata()

    expect(metadata!.viewerCount).toBe(10)
    verifyServicesUsed(false)
  })

  test('failed request', async () => {
    const expectedResponse = new Error()
    mockApiClient.streams.getStreamByUserName.calledWith(twitchChannelName).mockRejectedValue(expectedResponse)

    let actualResponse
    try {
      await twurpleApiProxyService.fetchMetadata()
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
