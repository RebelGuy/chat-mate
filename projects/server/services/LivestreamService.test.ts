import { Dependencies } from '@rebel/server/context/context'
import LivestreamService from '@rebel/server/services/LivestreamService'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { mockGetter, nameof, single } from '@rebel/server/_test/utils'
import { CalledWithMock, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { LiveStatus, Metadata } from '@rebel/masterchat'
import { Livestream } from '@prisma/client'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import { TwitchMetadata } from '@rebel/server/interfaces'
import { addTime } from '@rebel/server/util/datetime'

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

let mockLivestreamStore: MockProxy<LivestreamStore>
let mockMasterchatProxyService: MockProxy<MasterchatProxyService>
let mockTwurpleApiProxyService: MockProxy<TwurpleApiProxyService>
let mockLogService: MockProxy<LogService>
let mockTimerHelpers: MockProxy<TimerHelpers>
let mockViewershipStore: MockProxy<ViewershipStore>
let livestreamService: LivestreamService

beforeEach(() => {
  mockLivestreamStore = mock()
  mockMasterchatProxyService = mock()
  mockTwurpleApiProxyService = mock()
  mockLogService = mock()
  mockTimerHelpers = mock()
  mockViewershipStore = mock()

  // automatically execute callback passed to TimerHelpers
  const createRepeatingTimer = mockTimerHelpers.createRepeatingTimer as any as CreateRepeatingTimer
  createRepeatingTimer.mockImplementation(async (options, runImmediately) => {
    await options.callback()
    return 0
  })

  livestreamService = new LivestreamService(new Dependencies({
    livestreamStore: mockLivestreamStore,
    logService: mockLogService,
    masterchatProxyService: mockMasterchatProxyService,
    twurpleApiProxyService: mockTwurpleApiProxyService,
    timerHelpers: mockTimerHelpers,
    viewershipStore: mockViewershipStore,
    disableExternalApis: false
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
      viewershipStore: mockViewershipStore,
      disableExternalApis: true
    }))

    await livestreamService.initialise()
    
    expect(mockTimerHelpers.createRepeatingTimer.mock.calls.length).toBe(0)
    expect(mockMasterchatProxyService.fetchMetadata.mock.calls.length).toBe(0)
  })

  test('ignores times and views if receives `not_started` status from metadata', async () => {
    mockGetter(mockLivestreamStore, 'activeLivestream').mockReturnValue(makeStream(null, null))
    mockMasterchatProxyService.fetchMetadata.mockResolvedValue({ ...makeYoutubeMetadata('not_started'), viewerCount: 2 })
    mockTwurpleApiProxyService.fetchMetadata.mockResolvedValue(makeTwitchMetadata(10))

    await livestreamService.initialise()

    expect(mockLivestreamStore.setTimes.mock.calls.length).toBe(0)
  })

  test('passes to LivestreamStore if receives `live` status from metadata', async () => {
    mockGetter(mockLivestreamStore, 'activeLivestream').mockReturnValue(makeStream(null, null))
    mockMasterchatProxyService.fetchMetadata.mockResolvedValue(makeYoutubeMetadata('live'))

    await livestreamService.initialise()

    const [liveId, { start, end }] = single(mockLivestreamStore.setTimes.mock.calls)
    expect(liveId).toBe(data.livestream1.liveId)
    expect(start).not.toBeNull()
    expect(end).toBeNull()
  })

  test('passes to LivestreamStore if receives `finished` status from metadata', async () => {
    mockGetter(mockLivestreamStore, 'activeLivestream').mockReturnValue(makeStream(new Date(), null))
    mockMasterchatProxyService.fetchMetadata.mockResolvedValue(makeYoutubeMetadata('finished'))

    await livestreamService.initialise()

    const [liveId, { start, end }] = single(mockLivestreamStore.setTimes.mock.calls)
    expect(liveId).toBe(data.livestream1.liveId)
    expect(start).not.toBeNull()
    expect(end).not.toBeNull()
  })

  test('deactivates livestream if finished', async () => {
    const startDate = addTime(new Date(), 'minutes', -10)
    const endDate = addTime(new Date(), 'minutes', -5)
    mockGetter(mockLivestreamStore, 'activeLivestream').mockReturnValue(makeStream(startDate, endDate))

    await livestreamService.initialise()

    expect(mockLivestreamStore.deactivateLivestream.mock.calls.length).toBe(1)
  })

  test('ignores if invalid status', async () => {
    mockGetter(mockLivestreamStore, 'activeLivestream').mockReturnValue(makeStream(new Date(), new Date()))
    mockMasterchatProxyService.fetchMetadata.mockResolvedValue(makeYoutubeMetadata('live'))

    await livestreamService.initialise()

    expect(mockLivestreamStore.setTimes.mock.calls.length).toBe(0)
  })

  test('ignores if no active livestream', async () => {
    mockGetter(mockLivestreamStore, 'activeLivestream').mockReturnValue(null)

    await livestreamService.initialise()

    expect(mockMasterchatProxyService.addMasterchat.mock.calls.length).toBe(0)
    expect(mockMasterchatProxyService.fetchMetadata.mock.calls.length).toBe(0)
  })

  test('passes active livestream to masterchatProxyService', async () => {
    mockGetter(mockLivestreamStore, 'activeLivestream').mockReturnValue(makeStream(null, null))

    await livestreamService.initialise()

    expect(single(mockMasterchatProxyService.addMasterchat.mock.calls)).toEqual([data.livestream1.liveId])
  })

  test('updates metadata regularly', async () => {
    mockGetter(mockLivestreamStore, 'activeLivestream').mockReturnValue(makeStream(null, null))
    mockMasterchatProxyService.fetchMetadata.mockResolvedValue(makeYoutubeMetadata('not_started'))

    await livestreamService.initialise()

    expect(single(mockTimerHelpers.createRepeatingTimer.mock.calls)).toEqual([expect.anything(), true])
  })

  test('passes to ViewershipStore if receives live viewer count from metadata', async () => {
    mockGetter(mockLivestreamStore, 'activeLivestream').mockReturnValue(makeStream(new Date(), null))
    const metadata: Metadata = { ...makeYoutubeMetadata('live'), viewerCount: 10 }
    mockMasterchatProxyService.fetchMetadata.mockResolvedValue(metadata)
    mockTwurpleApiProxyService.fetchMetadata.mockResolvedValue(makeTwitchMetadata(5))

    await livestreamService.initialise()

    const [receivedYoutubeCount, receivedTwitchCount] = single(mockViewershipStore.addLiveViewCount.mock.calls)
    expect(receivedYoutubeCount).toBe(metadata.viewerCount)
    expect(receivedTwitchCount).toBe(5)
  })

  test('passes to ViewershipStore if receives live viewer count from youtube, but error from twitch', async () => {
    mockGetter(mockLivestreamStore, 'activeLivestream').mockReturnValue(makeStream(new Date(), null))
    const metadata: Metadata = { ...makeYoutubeMetadata('live'), viewerCount: 10 }
    mockMasterchatProxyService.fetchMetadata.mockResolvedValue(metadata)
    mockTwurpleApiProxyService.fetchMetadata.mockRejectedValue(new Error('Test error'))

    await livestreamService.initialise()

    const [receivedYoutubeCount, receivedTwitchCount] = single(mockViewershipStore.addLiveViewCount.mock.calls)
    expect(receivedYoutubeCount).toBe(metadata.viewerCount)
    expect(receivedTwitchCount).toBe(0)
  })

  test('ignores null from twitch metadata', async () => {
    mockGetter(mockLivestreamStore, 'activeLivestream').mockReturnValue(makeStream(new Date(), null))
    const metadata: Metadata = { ...makeYoutubeMetadata('live'), viewerCount: 10 }
    mockMasterchatProxyService.fetchMetadata.mockResolvedValue(metadata)
    mockTwurpleApiProxyService.fetchMetadata.mockResolvedValue(null)

    await livestreamService.initialise()

    const [receivedYoutubeCount, receivedTwitchCount] = single(mockViewershipStore.addLiveViewCount.mock.calls)
    expect(receivedYoutubeCount).toBe(metadata.viewerCount)
    expect(receivedTwitchCount).toBe(0)
  })

  test('ignores youtube error', async () => {
    mockMasterchatProxyService.fetchMetadata.mockRejectedValue(new Error('Test error'))
    mockTwurpleApiProxyService.fetchMetadata.mockRejectedValue(new Error('Test error'))

    await livestreamService.initialise()

    expect(mockViewershipStore.addLiveViewCount.mock.calls.length).toBe(0)
  })
})

describe(nameof(LivestreamService, 'setActiveLivestream'), () => {
  test('sets active livestream', async () => {
    const testLiveId = 'testLiveId'

    await livestreamService.setActiveLivestream(testLiveId)

    expect(single(mockLivestreamStore.setActiveLivestream.mock.calls)).toEqual([testLiveId, 'publicLivestream'])
    expect(single(mockMasterchatProxyService.addMasterchat.mock.calls)).toEqual([testLiveId])
  })
})

describe(nameof(LivestreamService, 'deactivateLivestream'), () => {
  test('deactivates livestream', async () => {
    const testLiveId = 'testLiveId'
    mockGetter(mockLivestreamStore, 'activeLivestream').mockReturnValue({ liveId: testLiveId } as any)

    await livestreamService.deactivateLivestream()

    expect(mockLivestreamStore.deactivateLivestream.mock.calls.length).toBe(1)
    expect(single(mockMasterchatProxyService.removeMasterchat.mock.calls)).toEqual([testLiveId])
  })
})
