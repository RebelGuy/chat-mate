import { Dependencies } from '@rebel/shared/context/context'
import WebsocketFactory from '@rebel/server/factories/WebsocketFactory'
import StatusService from '@rebel/server/services/StatusService'
import StreamlabsProxyService from '@rebel/server/services/StreamlabsProxyService'
import { expectObjectDeep } from '@rebel/shared/testUtils'
import { mock, MockProxy } from 'jest-mock-extended'
import PlatformApiStore from '@rebel/server/stores/PlatformApiStore'
import EventDispatchService, { EVENT_STREAMLABS_DONATION } from '@rebel/server/services/EventDispatchService'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'

const streamlabsAccessToken = 'accessToken'

let mockStreamlabsStatusService: MockProxy<StatusService>
let mockWebsocketFactory: MockProxy<WebsocketFactory>
let mockPlatformApiStore: MockProxy<PlatformApiStore>
let mockEventDispatchService: MockProxy<EventDispatchService>
let mockChatMateStateService: MockProxy<ChatMateStateService>
let streamlabsProxyService: StreamlabsProxyService

beforeEach(() => {
  mockStreamlabsStatusService = mock()
  mockWebsocketFactory = mock()
  mockPlatformApiStore = mock()
  mockEventDispatchService = mock()
  mockChatMateStateService = mock()

  streamlabsProxyService = new StreamlabsProxyService(new Dependencies({
    logService: mock(),
    nodeEnv: 'release',
    streamlabsAccessToken: streamlabsAccessToken,
    streamlabsStatusService: mockStreamlabsStatusService,
    websocketFactory: mockWebsocketFactory,
    platformApiStore: mockPlatformApiStore,
    eventDispatchService: mockEventDispatchService,
    chatMateStateService: mockChatMateStateService
  }))
})

describe('Integration tests', () => {
  let streamerSockets = new Map()

  test('Listening to donations creates one websocket for each streamer and calls back the DonationCallback, and stops calling it back after we stopped listening', async () => {
    const streamer1 = 1
    const streamer1Token = 'streamer1Token'
    const streamer2 = 2
    const streamer2Token = 'streamer2Token'

    const streamer1Socket: MockProxy<SocketIOClient.Socket> = mock()
    const streamer2Socket: MockProxy<SocketIOClient.Socket> = mock()
    mockWebsocketFactory.create.calledWith(expect.stringContaining(streamer1Token), expect.anything(), expect.anything()).mockReturnValue(streamer1Socket)
    mockWebsocketFactory.create.calledWith(expect.stringContaining(streamer2Token), expect.anything(), expect.anything()).mockReturnValue(streamer2Socket)
    mockChatMateStateService.getStreamlabsStreamerWebsockets.calledWith().mockReturnValue(streamerSockets)

    // act
    streamlabsProxyService.listenToStreamerDonations(streamer1, streamer1Token)
    streamlabsProxyService.listenToStreamerDonations(streamer2, streamer2Token)

    // assert
    expect(streamer1Socket.connect.mock.calls.length).toBe(1)
    expect(streamer2Socket.connect.mock.calls.length).toBe(1)

    // generate mock messages and emit them via the mock socket for the StreamlabsProxyService to consume
    const message1 = ({
      type: 'donation',
      message: [{
        id: 1,
        from_user_id: 2,
        amount: 3,
        formattedAmount: '3',
        currency: 'AUD',
        message: 'test1',
        from: 'User1'
      }]
    })
    const message2 = ({
      type: 'donation',
      message: [{
        id: 4,
        from_user_id: 5,
        amount: 6,
        formattedAmount: '6',
        currency: 'USD',
        message: 'test2',
        from: 'User2'
      }]
    })
    const [listener1, listener2] = mockWebsocketFactory.create.mock.calls.map(c => c[1].onMessage)
    await listener2!(message2) // ordering!
    await listener1!(message1)

    // this should have been relayed to the donation callback
    const addDataCalls = mockEventDispatchService.addData.mock.calls
    expect(addDataCalls).toEqual(expectObjectDeep(addDataCalls, [
      [EVENT_STREAMLABS_DONATION, { streamlabsDonation: { donationId: message2.message[0].id }}],
      [EVENT_STREAMLABS_DONATION, { streamlabsDonation: { donationId: message1.message[0].id }}]
    ]))

    // stop listening to streamer 1
    streamlabsProxyService.stopListeningToStreamerDonations(streamer1)

    await listener2!(message2)
    await listener1!(message1)

    expect(streamer1Socket.disconnect.mock.calls.length).toBe(1)
    expect(streamer2Socket.disconnect.mock.calls.length).toBe(0)
  })
})
