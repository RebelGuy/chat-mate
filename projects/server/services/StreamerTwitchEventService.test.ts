import HelixEventService, { EventSubType } from '@rebel/server/services/HelixEventService'
import StreamerTwitchEventService, { SubscriptionStatus } from '@rebel/server/services/StreamerTwitchEventService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import StreamerChannelStore, { PrimaryChannels } from '@rebel/server/stores/StreamerChannelStore'
import { cast, expectArray, expectObject, nameof } from '@rebel/shared/testUtils'
import { Dependencies } from '@rebel/shared/context/context'
import { mock, MockProxy } from 'jest-mock-extended'

let mockHelixEventService: MockProxy<HelixEventService>
let mockTwurpleService: MockProxy<TwurpleService>
let mockStreamerChannelStore: MockProxy<StreamerChannelStore>
let streamerTwitchEventService: StreamerTwitchEventService

beforeEach(() => {
  mockHelixEventService = mock()
  mockTwurpleService = mock()
  mockStreamerChannelStore = mock()

  streamerTwitchEventService = new StreamerTwitchEventService(new Dependencies({
    helixEventService: mockHelixEventService,
    twurpleService: mockTwurpleService,
    streamerChannelStore: mockStreamerChannelStore
  }))
})


describe(nameof(StreamerTwitchEventService, 'getStatuses'), () => {
  test('Returns null if the given streamer does not have a primary Twitch channel', async () => {
    const streamerId = 5
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray<number>([streamerId]))
      .mockResolvedValue([cast<PrimaryChannels>({ twitchChannel: null, youtubeChannel: {} })])

    const statuses = await streamerTwitchEventService.getStatuses(streamerId)

    expect(statuses).toBeNull()
  })

  test('Returns the chat and eventSub statuses for the streamer', async () => {
    const streamerId = 5
    const chatStatus: SubscriptionStatus = { status: 'active', lastChange: Date.now() }
    const eventSubStatus = cast<Record<EventSubType, SubscriptionStatus>>({ followers: { status: 'inactive', message: 'test', lastChange: Date.now() }})
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray<number>([streamerId]))
      .mockResolvedValue([cast<PrimaryChannels>({ twitchChannel: {} })])
    mockTwurpleService.getChatStatus.calledWith(streamerId).mockResolvedValue(chatStatus)
    mockHelixEventService.getEventSubscriptions.calledWith(streamerId).mockReturnValue(eventSubStatus)

    const statuses = await streamerTwitchEventService.getStatuses(streamerId)

    expect(statuses).toEqual(expectObject(statuses, {
      ...eventSubStatus,
      chat: chatStatus
    }))
  })
})
