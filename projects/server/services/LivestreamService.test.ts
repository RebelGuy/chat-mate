import { Dependencies } from '@rebel/shared/context/context'
import LivestreamService from '@rebel/server/services/LivestreamService'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { cast, mockGetter, nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/shared/util/arrays'
import { CalledWithMock, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { LiveStatus, Metadata } from '@rebel/masterchat'
import { Livestream } from '@prisma/client'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import { addTime } from '@rebel/shared/util/datetime'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import { TwitchMetadata } from '@rebel/server/services/TwurpleService'

// jest is having trouble mocking the correct overload method, so we have to force it into the correct type
type CreateRepeatingTimer = CalledWithMock<Promise<number>, [TimerOptions, true]>

function makeYoutubeMetadata (status: LiveStatus): Metadata {
  return {
    channelId: 'mock channel id',
    videoId: 'mock video id',
    channelName: 'mock channel name',
    liveStatus: status,
    title: 'mock title'
  }
}

function makeTwitchMetadata (viewers: number): TwitchMetadata {
  return {
    startTime: new Date(),
    streamId: '123',
    title: 'Stream',
    viewerCount: viewers
  }
}

function makeStream (start: Date | null, end: Date | null): Livestream {
  return {
    ...data.livestream1,
    start,
    end
  }
}

const streamer1 = 1
const streamer2 = 2

let mockLivestreamStore: MockProxy<LivestreamStore>
let mockMasterchatProxyService: MockProxy<MasterchatProxyService>
let mockTwurpleApiProxyService: MockProxy<TwurpleApiProxyService>
let mockLogService: MockProxy<LogService>
let mockTimerHelpers: MockProxy<TimerHelpers>
let mockDateTimeHelpers: MockProxy<DateTimeHelpers>
let mockStreamerChannelService: MockProxy<StreamerChannelService>
let livestreamService: LivestreamService

beforeEach(() => {
  mockLivestreamStore = mock()
  mockMasterchatProxyService = mock()
  mockTwurpleApiProxyService = mock()
  mockLogService = mock()
  mockTimerHelpers = mock()
  mockDateTimeHelpers = mock()
  mockStreamerChannelService = mock()

  // automatically execute callback passed to TimerHelpers
  const createRepeatingTimer = mockTimerHelpers.createRepeatingTimer as any as CreateRepeatingTimer
  createRepeatingTimer.mockImplementation(async (options, runImmediately) => {
    await options.callback()
    return 0
  })

  mockDateTimeHelpers.now.calledWith().mockReturnValue(new Date())

  livestreamService = new LivestreamService(new Dependencies({
    livestreamStore: mockLivestreamStore,
    logService: mockLogService,
    masterchatProxyService: mockMasterchatProxyService,
    twurpleApiProxyService: mockTwurpleApiProxyService,
    timerHelpers: mockTimerHelpers,
    disableExternalApis: false,
    dateTimeHelpers: mockDateTimeHelpers,
    streamerChannelService: mockStreamerChannelService
  }))
})

describe(nameof(LivestreamService, 'initialise'), () => {
  test('ignores api if disableExternalApis is true', async () => {
    livestreamService = new LivestreamService(new Dependencies({
      livestreamStore: mockLivestreamStore,
      logService: mockLogService,
      masterchatProxyService: mockMasterchatProxyService,
      twurpleApiProxyService: mockTwurpleApiProxyService,
      timerHelpers: mockTimerHelpers,
      disableExternalApis: true,
      dateTimeHelpers: mockDateTimeHelpers,
      streamerChannelService: mockStreamerChannelService
    }))

    await livestreamService.initialise()

    expect(mockTimerHelpers.createRepeatingTimer.mock.calls.length).toBe(0)
    expect(mockMasterchatProxyService.fetchMetadata.mock.calls.length).toBe(0)
  })

  test('ignores times and views if receives `not_started` status from metadata', async () => {
    const livestream = makeStream(null, null)
    const twitchChannelName = 'twitchChannelName'
    mockLivestreamStore.getActiveLivestreams.calledWith().mockResolvedValue([livestream])
    mockStreamerChannelService.getTwitchChannelName.calledWith(livestream.streamerId).mockResolvedValue(twitchChannelName)
    mockMasterchatProxyService.fetchMetadata.calledWith(livestream.liveId).mockResolvedValue({ ...makeYoutubeMetadata('not_started'), viewerCount: 2 })
    mockTwurpleApiProxyService.fetchMetadata.calledWith(twitchChannelName).mockResolvedValue(makeTwitchMetadata(10))

    await livestreamService.initialise()

    expect(mockLivestreamStore.setTimes.mock.calls.length).toBe(0)
  })

  test('passes to LivestreamStore if receives `live` status from metadata', async () => {
    const livestream = makeStream(null, null)
    mockLivestreamStore.getActiveLivestreams.calledWith().mockResolvedValue([livestream])
    mockMasterchatProxyService.fetchMetadata.calledWith(livestream.liveId).mockResolvedValue(makeYoutubeMetadata('live'))

    await livestreamService.initialise()

    const [liveId, { start, end }] = single(mockLivestreamStore.setTimes.mock.calls)
    expect(liveId).toBe(livestream.liveId)
    expect(start).not.toBeNull()
    expect(end).toBeNull()
  })

  test('passes to LivestreamStore if receives `finished` status from metadata', async () => {
    const livestream = makeStream(new Date(), null)
    mockLivestreamStore.getActiveLivestreams.calledWith().mockResolvedValue([livestream])
    mockMasterchatProxyService.fetchMetadata.calledWith(livestream.liveId).mockResolvedValue(makeYoutubeMetadata('finished'))

    await livestreamService.initialise()

    const [liveId, { start, end }] = single(mockLivestreamStore.setTimes.mock.calls)
    expect(liveId).toBe(livestream.liveId)
    expect(start).not.toBeNull()
    expect(end).not.toBeNull()
  })

  test('deactivates livestream if finished', async () => {
    const startDate = addTime(new Date(), 'minutes', -10)
    const endDate = addTime(new Date(), 'minutes', -5)
    const livestream = makeStream(startDate, endDate)
    mockLivestreamStore.getActiveLivestreams.calledWith().mockResolvedValue([livestream])
    mockLivestreamStore.getActiveLivestream.calledWith(streamer1).mockResolvedValue(livestream)

    await livestreamService.initialise()

    expect(mockLivestreamStore.deactivateLivestream.mock.calls.length).toBe(1)
  })

  test('ignores if invalid status', async () => {
    const livestream = makeStream(new Date(), new Date())
    mockLivestreamStore.getActiveLivestreams.calledWith().mockResolvedValue([livestream])
    mockMasterchatProxyService.fetchMetadata.calledWith(livestream.liveId).mockResolvedValue(makeYoutubeMetadata('live'))

    await livestreamService.initialise()

    expect(mockLivestreamStore.setTimes.mock.calls.length).toBe(0)
  })

  test('ignores if no active livestream', async () => {
    mockLivestreamStore.getActiveLivestreams.calledWith().mockResolvedValue([])

    await livestreamService.initialise()

    expect(mockMasterchatProxyService.addMasterchat.mock.calls.length).toBe(0)
    expect(mockMasterchatProxyService.fetchMetadata.mock.calls.length).toBe(0)
  })

  test('passes active livestreams to masterchatProxyService', async () => {
    const livestream1 = makeStream(null, null)
    const livestream2 = { ...makeStream(null, null), id: 2, liveId: 'live2' }
    mockLivestreamStore.getActiveLivestreams.calledWith().mockResolvedValue([livestream1, livestream2])

    await livestreamService.initialise()

    const addedLiveIds = mockMasterchatProxyService.addMasterchat.mock.calls.map(args => single(args))
    expect(addedLiveIds).toEqual([livestream1.liveId, livestream2.liveId])
  })

  test('updates metadata regularly', async () => {
    const livestream = makeStream(null, null)
    mockLivestreamStore.getActiveLivestreams.calledWith().mockResolvedValue([livestream])
    mockMasterchatProxyService.fetchMetadata.calledWith(livestream.liveId).mockResolvedValue(makeYoutubeMetadata('not_started'))

    await livestreamService.initialise()

    expect(single(mockTimerHelpers.createRepeatingTimer.mock.calls)).toEqual([expect.anything(), true])
  })

  test('passes to ViewershipStore if receives live viewer count from metadata', async () => {
    const livestream = makeStream(new Date(), null)
    const twitchChannelName = 'twitchChannelName'
    const metadata: Metadata = { ...makeYoutubeMetadata('live'), viewerCount: 10 }
    mockLivestreamStore.getActiveLivestreams.calledWith().mockResolvedValue([livestream])
    mockStreamerChannelService.getTwitchChannelName.calledWith(livestream.streamerId).mockResolvedValue(twitchChannelName)
    mockMasterchatProxyService.fetchMetadata.calledWith(livestream.liveId).mockResolvedValue(metadata)
    mockTwurpleApiProxyService.fetchMetadata.calledWith(twitchChannelName).mockResolvedValue(makeTwitchMetadata(5))

    await livestreamService.initialise()

    const [receivedLivestreamId, receivedYoutubeCount, receivedTwitchCount] = single(mockLivestreamStore.addLiveViewCount.mock.calls)
    expect(receivedLivestreamId).toBe(livestream.id)
    expect(receivedYoutubeCount).toBe(metadata.viewerCount)
    expect(receivedTwitchCount).toBe(5)
  })

  test('passes to ViewershipStore if receives live viewer count from youtube, but error from twitch', async () => {
    const livestream = makeStream(new Date(), null)
    const twitchChannelName = 'twitchChannelName'
    const metadata: Metadata = { ...makeYoutubeMetadata('live'), viewerCount: 10 }
    mockLivestreamStore.getActiveLivestreams.calledWith().mockResolvedValue([livestream])
    mockStreamerChannelService.getTwitchChannelName.calledWith(livestream.streamerId).mockResolvedValue(twitchChannelName)
    mockMasterchatProxyService.fetchMetadata.calledWith(livestream.liveId).mockResolvedValue(metadata)
    mockTwurpleApiProxyService.fetchMetadata.calledWith(twitchChannelName).mockRejectedValue(new Error('Test error'))

    await livestreamService.initialise()

    const [receivedLivestreamId, receivedYoutubeCount, receivedTwitchCount] = single(mockLivestreamStore.addLiveViewCount.mock.calls)
    expect(receivedLivestreamId).toBe(data.livestream1.id)
    expect(receivedYoutubeCount).toBe(metadata.viewerCount)
    expect(receivedTwitchCount).toBe(0)
  })

  test('ignores null from twitch metadata', async () => {
    const livestream = makeStream(new Date(), null)
    const twitchChannelName = 'twitchChannelName'
    const metadata: Metadata = { ...makeYoutubeMetadata('live'), viewerCount: 10 }
    mockLivestreamStore.getActiveLivestreams.calledWith().mockResolvedValue([livestream])
    mockStreamerChannelService.getTwitchChannelName.calledWith(livestream.streamerId).mockResolvedValue(twitchChannelName)
    mockMasterchatProxyService.fetchMetadata.calledWith(livestream.liveId).mockResolvedValue(metadata)
    mockTwurpleApiProxyService.fetchMetadata.calledWith(twitchChannelName).mockResolvedValue(null)

    await livestreamService.initialise()

    const [receivedLivestreamId, receivedYoutubeCount, receivedTwitchCount] = single(mockLivestreamStore.addLiveViewCount.mock.calls)
    expect(receivedLivestreamId).toBe(livestream.id)
    expect(receivedYoutubeCount).toBe(metadata.viewerCount)
    expect(receivedTwitchCount).toBe(0)
  })

  test('ignores API errors', async () => {
    const twitchChannelName = 'twitchChannelName'
    mockLivestreamStore.getActiveLivestreams.calledWith().mockResolvedValue([data.livestream1])
    mockDateTimeHelpers.now.mockReset().calledWith().mockReturnValue(data.livestream1.end!)
    mockStreamerChannelService.getTwitchChannelName.calledWith(data.livestream1.streamerId).mockResolvedValue(twitchChannelName)
    mockMasterchatProxyService.fetchMetadata.calledWith(data.livestream1.liveId).mockRejectedValue(new Error('Test error'))
    mockTwurpleApiProxyService.fetchMetadata.calledWith(twitchChannelName).mockRejectedValue(new Error('Test error'))

    await livestreamService.initialise()

    expect(mockMasterchatProxyService.fetchMetadata.mock.calls.length).toBe(1)
    expect(mockLivestreamStore.addLiveViewCount.mock.calls.length).toBe(0)
  })
})

describe(nameof(LivestreamService, 'setActiveLivestream'), () => {
  test('sets active livestream', async () => {
    const testLiveId = 'testLiveId'

    await livestreamService.setActiveLivestream(streamer1, testLiveId)

    expect(single(mockLivestreamStore.setActiveLivestream.mock.calls)).toEqual([streamer1, testLiveId, 'publicLivestream'])
    expect(single(mockMasterchatProxyService.addMasterchat.mock.calls)).toEqual([testLiveId])
  })
})

describe(nameof(LivestreamService, 'deactivateLivestream'), () => {
  test('deactivates livestream', async () => {
    const testLiveId = 'testLiveId'
    mockLivestreamStore.getActiveLivestream.calledWith(streamer1).mockResolvedValue(cast<Livestream>({ liveId: testLiveId }))

    await livestreamService.deactivateLivestream(streamer1)

    expect(single(mockLivestreamStore.deactivateLivestream.mock.calls)).toEqual([streamer1])
    expect(single(mockMasterchatProxyService.removeMasterchat.mock.calls)).toEqual([testLiveId])
  })
})
