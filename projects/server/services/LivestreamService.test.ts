import { Dependencies } from '@rebel/shared/context/context'
import LivestreamService from '@rebel/server/services/LivestreamService'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { cast, expectObject, nameof } from '@rebel/shared/testUtils'
import { single, single2 } from '@rebel/shared/util/arrays'
import { CalledWithMock, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { LiveStatus, MasterchatError, Metadata } from '@rebel/masterchat'
import TimerHelpers, { TimerOptions } from '@rebel/server/helpers/TimerHelpers'
import MasterchatService from '@rebel/server/services/MasterchatService'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import { addTime } from '@rebel/shared/util/datetime'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import StreamerChannelService from '@rebel/server/services/StreamerChannelService'
import { TwitchMetadata } from '@rebel/server/services/TwurpleService'
import { TwitchLivestream, YoutubeLivestream } from '@prisma/client'

// jest is having trouble mocking the correct overload method, so we have to force it into the correct type
type CreateRepeatingTimer = CalledWithMock<Promise<number>, [TimerOptions, true]>

function makeYoutubeMetadata (status: LiveStatus): Metadata {
  return {
    channelId: 'mock channel id',
    videoId: 'mock video id',
    channelName: 'mock channel name',
    liveStatus: status,
    title: 'mock title',
    viewerCount: status === 'live' ? viewCount : undefined
  }
}

function makeYoutubeStream (start: Date | null, end: Date | null): YoutubeLivestream {
  return {
    ...data.livestream1,
    streamerId,
    start,
    end
  }
}

function makeTwitchStream (start: Date, end: Date | null): TwitchLivestream {
  return {
    id: 100,
    streamerId,
    start,
    end
  }
}

const streamerId = 65
const viewCount = 5
const twitchChannelName = 'twitchChannel'

let mockLivestreamStore: MockProxy<LivestreamStore>
let mockMasterchatService: MockProxy<MasterchatService>
let mockTwurpleApiProxyService: MockProxy<TwurpleApiProxyService>
let mockLogService: MockProxy<LogService>
let mockTimerHelpers: MockProxy<TimerHelpers>
let mockDateTimeHelpers: MockProxy<DateTimeHelpers>
let mockStreamerChannelService: MockProxy<StreamerChannelService>
let livestreamService: LivestreamService

beforeEach(() => {
  mockLivestreamStore = mock()
  mockMasterchatService = mock()
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
    masterchatService: mockMasterchatService,
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
      masterchatService: mockMasterchatService,
      twurpleApiProxyService: mockTwurpleApiProxyService,
      timerHelpers: mockTimerHelpers,
      disableExternalApis: true,
      dateTimeHelpers: mockDateTimeHelpers,
      streamerChannelService: mockStreamerChannelService
    }))

    await livestreamService.initialise()

    expect(mockTimerHelpers.createRepeatingTimer.mock.calls.length).toBe(0)
    expect(mockMasterchatService.fetchMetadata.mock.calls.length).toBe(0)
  })

  describe('Youtube tests', () => {
    beforeEach(() => {
      mockLivestreamStore.getCurrentTwitchLivestreams.calledWith().mockResolvedValue([])
    })

    test(`Ignores times and views if livestream hasn't started`, async () => {
      const livestream = makeYoutubeStream(null, null)
      mockLivestreamStore.getActiveYoutubeLivestreams.calledWith().mockResolvedValue([livestream])
      mockMasterchatService.fetchMetadata.calledWith(livestream.streamerId).mockResolvedValue({ ...makeYoutubeMetadata('not_started') })

      await livestreamService.initialise()

      expect(mockLivestreamStore.setYoutubeLivestreamTimes.mock.calls.length).toBe(0)
      expect(mockLivestreamStore.addYoutubeLiveViewCount.mock.calls.length).toBe(0)
    })

    test('Updates time and view when livestream starts', async () => {
      const livestream = makeYoutubeStream(null, null)
      const startTime = data.time3
      mockLivestreamStore.getActiveYoutubeLivestreams.calledWith().mockResolvedValue([livestream])
      mockMasterchatService.fetchMetadata.calledWith(livestream.streamerId).mockResolvedValue(makeYoutubeMetadata('live'))
      mockDateTimeHelpers.now.mockReset().calledWith().mockReturnValue(startTime)

      await livestreamService.initialise()

      const livestreamTimesArgs = single(mockLivestreamStore.setYoutubeLivestreamTimes.mock.calls)
      expect(livestreamTimesArgs).toEqual<typeof livestreamTimesArgs>([livestream.liveId, { start: startTime, end: null }])
      const viewCountArgs = single(mockLivestreamStore.addYoutubeLiveViewCount.mock.calls)
      expect(viewCountArgs).toEqual<typeof viewCountArgs>([livestream.id, viewCount])
    })

    test('Updates time but not views when livestream finishes', async () => {
      const startTime = data.time3
      const livestream = makeYoutubeStream(startTime, null)
      const endTime = data.time4
      mockLivestreamStore.getActiveYoutubeLivestreams.calledWith().mockResolvedValue([livestream])
      mockMasterchatService.fetchMetadata.calledWith(livestream.streamerId).mockResolvedValue(makeYoutubeMetadata('finished'))
      mockDateTimeHelpers.now.mockReset().calledWith().mockReturnValue(endTime)

      await livestreamService.initialise()

      const livestreamTimesArgs = single(mockLivestreamStore.setYoutubeLivestreamTimes.mock.calls)
      expect(livestreamTimesArgs).toEqual<typeof livestreamTimesArgs>([livestream.liveId, { start: startTime, end: endTime }])
      expect(mockLivestreamStore.addYoutubeLiveViewCount.mock.calls.length).toBe(0)
    })

    test('Deactivates livestream when finished', async () => {
      const startDate = addTime(new Date(), 'minutes', -10)
      const endDate = addTime(new Date(), 'minutes', -5)
      const livestream = makeYoutubeStream(startDate, endDate)
      mockLivestreamStore.getActiveYoutubeLivestreams.calledWith().mockResolvedValue([livestream])
      mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(livestream)

      await livestreamService.initialise()

      expect(single2(mockLivestreamStore.deactivateYoutubeLivestream.mock.calls)).toBe(streamerId)
      expect(mockLivestreamStore.setYoutubeLivestreamTimes.mock.calls.length).toBe(0)
      expect(mockLivestreamStore.addYoutubeLiveViewCount.mock.calls.length).toBe(0)
    })

    test('Deactivates livestream if not available', async () => {
      const livestream = makeYoutubeStream(new Date(), null)
      mockLivestreamStore.getActiveYoutubeLivestreams.calledWith().mockResolvedValue([livestream])
      mockLivestreamStore.getActiveYoutubeLivestream.calledWith(livestream.streamerId).mockResolvedValue(livestream)
      mockMasterchatService.fetchMetadata.calledWith(livestream.streamerId).mockRejectedValue(new MasterchatError('denied', ''))

      await livestreamService.initialise()

      expect(mockLivestreamStore.deactivateYoutubeLivestream.mock.calls.length).toBe(1)
      expect(mockLivestreamStore.setYoutubeLivestreamTimes.mock.calls.length).toBe(0)
      expect(mockLivestreamStore.addYoutubeLiveViewCount.mock.calls.length).toBe(0)
    })

    test('Ignores if invalid status', async () => {
      const livestream = makeYoutubeStream(new Date(), new Date())
      mockLivestreamStore.getActiveYoutubeLivestreams.calledWith().mockResolvedValue([livestream])
      mockMasterchatService.fetchMetadata.calledWith(livestream.streamerId).mockResolvedValue(makeYoutubeMetadata('live'))

      await livestreamService.initialise()

      expect(mockLivestreamStore.setYoutubeLivestreamTimes.mock.calls.length).toBe(0)
      expect(mockLivestreamStore.addYoutubeLiveViewCount.mock.calls.length).toBe(0)
    })

    test('Ignores if no active livestream', async () => {
      mockLivestreamStore.getActiveYoutubeLivestreams.calledWith().mockResolvedValue([])

      await livestreamService.initialise()

      expect(mockMasterchatService.addMasterchat.mock.calls.length).toBe(0)
      expect(mockMasterchatService.fetchMetadata.mock.calls.length).toBe(0)
      expect(mockLivestreamStore.setYoutubeLivestreamTimes.mock.calls.length).toBe(0)
      expect(mockLivestreamStore.addYoutubeLiveViewCount.mock.calls.length).toBe(0)
    })

    test('Passes active livestreams to masterchatService', async () => {
      const livestream1 = makeYoutubeStream(null, null)
      const livestream2 = { ...makeYoutubeStream(null, null), id: 2, liveId: 'live2' }
      mockLivestreamStore.getActiveYoutubeLivestreams.calledWith().mockResolvedValue([livestream1, livestream2])

      await livestreamService.initialise()

      const addedLiveIds = mockMasterchatService.addMasterchat.mock.calls
      expect(addedLiveIds).toEqual<typeof addedLiveIds>([[livestream1.streamerId, livestream1.liveId], [livestream2.streamerId, livestream2.liveId]])
    })

    test('Updates metadata regularly', async () => {
      const livestream = makeYoutubeStream(null, null)
      mockLivestreamStore.getActiveYoutubeLivestreams.calledWith().mockResolvedValue([livestream])
      mockMasterchatService.fetchMetadata.calledWith(livestream.streamerId).mockResolvedValue(makeYoutubeMetadata('not_started'))

      await livestreamService.initialise()

      expect(single(mockTimerHelpers.createRepeatingTimer.mock.calls)).toEqual([expect.anything(), true])
    })

    test('Ignores API errors', async () => {
      mockLivestreamStore.getActiveYoutubeLivestreams.calledWith().mockResolvedValue([data.livestream1])
      mockDateTimeHelpers.now.mockReset().calledWith().mockReturnValue(data.livestream1.end!)
      mockMasterchatService.fetchMetadata.calledWith(data.livestream1.streamerId).mockRejectedValue(new Error('Test error'))

      await livestreamService.initialise()

      expect(mockMasterchatService.fetchMetadata.mock.calls.length).toBe(1)
      expect(mockLivestreamStore.setYoutubeLivestreamTimes.mock.calls.length).toBe(0)
      expect(mockLivestreamStore.addYoutubeLiveViewCount.mock.calls.length).toBe(0)
    })
  })

  describe('Twitch tests', () => {
    const twitchMetadata: TwitchMetadata = {
      startTime: new Date(),
      streamId: '123',
      title: 'Stream',
      viewerCount: viewCount
    }

    beforeEach(() => {
      mockLivestreamStore.getActiveYoutubeLivestreams.calledWith().mockResolvedValue([])
      mockStreamerChannelService.getTwitchChannelName.calledWith(streamerId).mockResolvedValue(twitchChannelName)
    })

    test('Updates the end time when the livestream finishes', async () => {
      const endTime = data.time4
      const livestream = makeTwitchStream(data.time2, null)
      mockLivestreamStore.getCurrentTwitchLivestreams.calledWith().mockResolvedValue([livestream])
      mockTwurpleApiProxyService.fetchMetadata.calledWith(livestream.streamerId, twitchChannelName).mockResolvedValue(null)
      mockDateTimeHelpers.now.mockReset().calledWith().mockReturnValue(endTime)

      await livestreamService.initialise()

      const livestreamTimesArgs = single(mockLivestreamStore.setTwitchLivestreamTimes.mock.calls)
      expect(livestreamTimesArgs).toEqual<typeof livestreamTimesArgs>([livestream.id, { start: livestream.start, end: endTime }])
      expect(mockLivestreamStore.addTwitchLiveViewCount.mock.calls.length).toBe(0)
    })

    test('Updates the view count while the livestream is live', async () => {
      const livestream = makeTwitchStream(data.time2, null)
      mockLivestreamStore.getCurrentTwitchLivestreams.calledWith().mockResolvedValue([livestream])
      mockTwurpleApiProxyService.fetchMetadata.calledWith(livestream.streamerId, twitchChannelName).mockResolvedValue(twitchMetadata)

      await livestreamService.initialise()

      const livestreamTimesArgs = single(mockLivestreamStore.addTwitchLiveViewCount.mock.calls)
      expect(livestreamTimesArgs).toEqual<typeof livestreamTimesArgs>([livestream.id, viewCount])
      expect(mockLivestreamStore.setTwitchLivestreamTimes.mock.calls.length).toBe(0)
    })

    test('Updates metadata regularly', async () => {
      const livestream = makeTwitchStream(data.time2, null)
      mockLivestreamStore.getCurrentTwitchLivestreams.calledWith().mockResolvedValue([livestream])
      mockTwurpleApiProxyService.fetchMetadata.calledWith(livestream.streamerId, twitchChannelName).mockResolvedValue(twitchMetadata)

      await livestreamService.initialise()

      expect(single(mockTimerHelpers.createRepeatingTimer.mock.calls)).toEqual([expect.anything(), true])
    })

    test('Ignores API errors', async () => {
      const livestream = makeTwitchStream(data.time2, null)
      mockLivestreamStore.getCurrentTwitchLivestreams.calledWith().mockResolvedValue([livestream])
      mockTwurpleApiProxyService.fetchMetadata.calledWith(livestream.streamerId, twitchChannelName).mockRejectedValue(new Error('Test error'))

      await livestreamService.initialise()

      expect(mockTwurpleApiProxyService.fetchMetadata.mock.calls.length).toBe(1)
      expect(mockLivestreamStore.setTwitchLivestreamTimes.mock.calls.length).toBe(0)
      expect(mockLivestreamStore.addTwitchLiveViewCount.mock.calls.length).toBe(0)
    })
  })
})

describe(nameof(LivestreamService, 'deactivateYoutubeLivestream'), () => {
  test('Deactivates livestream', async () => {
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(cast<YoutubeLivestream>({ streamerId: streamerId }))

    await livestreamService.deactivateYoutubeLivestream(streamerId)

    expect(single(mockLivestreamStore.deactivateYoutubeLivestream.mock.calls)).toEqual([streamerId])
    expect(single(mockMasterchatService.removeMasterchat.mock.calls)).toEqual([streamerId])
  })

  test('Does not activate livestream if there is no active livestream for the streamer', async () => {
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(null)

    await livestreamService.deactivateYoutubeLivestream(streamerId)

    expect(mockLivestreamStore.deactivateYoutubeLivestream.mock.calls.length).toBe(0)
  })
})

describe(nameof(LivestreamService, 'setActiveYoutubeLivestream'), () => {
  test('sets active livestream', async () => {
    const testLiveId = 'testLiveId'
    const youtubeId = 'testYoutubeId'
    mockStreamerChannelService.getYoutubeExternalId.calledWith(streamerId).mockResolvedValue(youtubeId)
    mockMasterchatService.getChannelIdFromAnyLiveId.calledWith(testLiveId).mockResolvedValue(youtubeId)

    await livestreamService.setActiveYoutubeLivestream(streamerId, testLiveId)

    expect(single(mockLivestreamStore.setActiveYoutubeLivestream.mock.calls)).toEqual([streamerId, testLiveId])
    expect(single(mockMasterchatService.addMasterchat.mock.calls)).toEqual([streamerId, testLiveId])
  })

  test('throws if the streamer does not have a primary YouTube channel', async () => {
    const testLiveId = 'testLiveId'
    mockStreamerChannelService.getYoutubeExternalId.calledWith(streamerId).mockResolvedValue(null)

    await expect(() => livestreamService.setActiveYoutubeLivestream(streamerId, testLiveId)).rejects.toThrow()

    expect(mockLivestreamStore.setActiveYoutubeLivestream.mock.calls.length).toEqual(0)
    expect(mockMasterchatService.addMasterchat.mock.calls.length).toEqual(0)
  })

  test(`throws if the streamer's YouTube channel is different to the livestream's YouTube channel`, async () => {
    const testLiveId = 'testLiveId'
    const youtubeId1 = 'testYoutubeId1'
    const youtubeId2 = 'testYoutubeId2'
    mockStreamerChannelService.getYoutubeExternalId.calledWith(streamerId).mockResolvedValue(youtubeId1)
    mockMasterchatService.getChannelIdFromAnyLiveId.calledWith(testLiveId).mockResolvedValue(youtubeId2)

    await expect(() => livestreamService.setActiveYoutubeLivestream(streamerId, testLiveId)).rejects.toThrow()

    expect(mockLivestreamStore.setActiveYoutubeLivestream.mock.calls.length).toEqual(0)
    expect(mockMasterchatService.addMasterchat.mock.calls.length).toEqual(0)
  })
})

describe(nameof(LivestreamService, 'onTwitchLivestreamStarted'), () => {
  test('Creates a new livestream if the previous livestream was long ago', async () => {
    mockLivestreamStore.getPreviousTwitchLivestream.calledWith(streamerId).mockResolvedValue(cast<TwitchLivestream>({ end: data.time1 }))
    mockDateTimeHelpers.ts.mockReset().calledWith().mockReturnValue(data.time2.getTime())
    mockLivestreamStore.addNewTwitchLivestream.calledWith(streamerId).mockResolvedValue(cast<TwitchLivestream>({}))

    await livestreamService.onTwitchLivestreamStarted(streamerId)

    expect(single2(mockLivestreamStore.addNewTwitchLivestream.mock.calls)).toBe(streamerId)
  })

  test('Re-activates the previous livestream if it ended recently', async () => {
    const prevLivestream = cast<TwitchLivestream>({ id: 123, end: data.time1 })
    mockDateTimeHelpers.ts.mockReset().calledWith().mockReturnValue(data.time1.getTime() + 60_000)
    mockLivestreamStore.getPreviousTwitchLivestream.calledWith(streamerId).mockResolvedValue(prevLivestream)

    await livestreamService.onTwitchLivestreamStarted(streamerId)

    const args = single(mockLivestreamStore.setTwitchLivestreamTimes.mock.calls)
    expect(args).toEqual(expectObject(args, [prevLivestream.id, { end: null }]))
  })

  test('Does not do anything if a Twitch livestream is already current', async () => {
    mockLivestreamStore.getCurrentTwitchLivestream.calledWith(streamerId).mockResolvedValue(cast<TwitchLivestream>({}))

    await livestreamService.onTwitchLivestreamStarted(streamerId)

    expect(mockLivestreamStore.addNewTwitchLivestream.mock.calls.length).toBe(0)
  })
})

describe(nameof(LivestreamService, 'onTwitchLivestreamEnded'), () => {
  test('Sets the end time of the Twitch livestream to now', async () => {
    const currentStream = cast<TwitchLivestream>({ id: 123, start: data.time1, end: null })
    mockLivestreamStore.getCurrentTwitchLivestream.calledWith(streamerId).mockResolvedValue(currentStream)
    mockDateTimeHelpers.now.mockReset().calledWith().mockReturnValue(data.time2)

    await livestreamService.onTwitchLivestreamEnded(streamerId)

    const args = single(mockLivestreamStore.setTwitchLivestreamTimes.mock.calls)
    expect(args).toEqual(expectObject(args, [currentStream.id, { start: currentStream.start, end: data.time2 }]))
  })

  test('Throws if there is no current Twitch livestream', async () => {
    await expect(() => livestreamService.onTwitchLivestreamEnded(streamerId)).rejects.toThrowError()
  })
})
