import { Dependencies } from '@rebel/shared/context/context'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import { cast, nameof } from '@rebel/shared/testUtils'
import { HelixStream } from '@twurple/api/lib/api/helix/stream/HelixStream'
import { ApiClient, HelixUser } from '@twurple/api'
import { DeepMockProxy, mock, MockProxy } from 'jest-mock-extended'
import { ChatClient } from '@twurple/chat/lib'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import { HelixUserData } from '@twurple/api/lib/interfaces/helix/user.external'

const chatMateModeratorId: string = 'moderator id'

let mockLogService: MockProxy<LogService>
let mockStatusService: MockProxy<StatusService>
let mockApiClient: DeepMockProxy<ApiClient>
let mockChatClient: MockProxy<ChatClient>
let mockTwitchUsername: string
let twurpleApiProxyService: TwurpleApiProxyService

beforeEach(() => {
  jest.useFakeTimers()
  mockLogService = mock()
  mockStatusService = mock()
  mockApiClient = mock({ streams: mock(), users: mock() }) as any // the compiler wants us to mock every property individually?
  const mockTwurpleApiClientProvider = mock<TwurpleApiClientProvider>({ get: () => Promise.resolve(mockApiClient) })
  mockChatClient = mock()
  const mockTwurpleChatClientProvider = mock<TwurpleChatClientProvider>({ get: () => mockChatClient })
  mockTwitchUsername = 'twitchUsername'

  twurpleApiProxyService = new TwurpleApiProxyService(new Dependencies({
    logService: mockLogService,
    twurpleApiClientProvider: mockTwurpleApiClientProvider,
    twurpleChatClientProvider: mockTwurpleChatClientProvider,
    twurpleStatusService: mockStatusService,
    isAdministrativeMode: () => false,
    twitchUsername: mockTwitchUsername
  }))
  twurpleApiProxyService.initialise()
})

// this test mirrors the MasterchatService tests implementation
describe(nameof(TwurpleApiProxyService, 'fetchMetadata'), () => {
  test('successful request', async () => {
    const streamerChannelName = 'streamerChannelName'
    const mockedResponse: HelixStream = new HelixStream({ viewer_count: 10 } as any, mockApiClient)
    mockApiClient.streams.getStreamByUserName.calledWith(streamerChannelName).mockResolvedValue(mockedResponse)

    const metadata = await twurpleApiProxyService.fetchMetadata(streamerChannelName)

    expect(metadata!.viewerCount).toBe(10)
    verifyServicesUsed(false)
  })

  test('failed request', async () => {
    const streamerChannelName = 'streamerChannelName'
    const expectedResponse = new Error()
    mockApiClient.streams.getStreamByUserName.calledWith(streamerChannelName).mockRejectedValue(expectedResponse)

    let actualResponse
    try {
      await twurpleApiProxyService.fetchMetadata(streamerChannelName)
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
