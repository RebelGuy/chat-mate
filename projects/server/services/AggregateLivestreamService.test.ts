import { TwitchLivestream, YoutubeLivestream } from '@prisma/client'
import AggregateLivestreamService from '@rebel/server/services/AggregateLivestreamService'
import LivestreamStore, { TwitchLivestreamParticipation, YoutubeLivestreamParticipation } from '@rebel/server/stores/LivestreamStore'
import { Dependencies } from '@rebel/shared/context/context'
import { cast, expectObject, expectObjectDeep, nameof } from '@rebel/shared/testUtils'
import { MockProxy, mock } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import AggregateLivestream from '@rebel/server/models/AggregateLivestream'
import { ChatMateError } from '@rebel/shared/util/error'

const streamerId = 15

let mockLivestreamStore: MockProxy<LivestreamStore>
let aggregateLivestreamService: AggregateLivestreamService

beforeEach(() => {
  mockLivestreamStore = mock()

  aggregateLivestreamService = new AggregateLivestreamService(new Dependencies({
    livestreamStore: mockLivestreamStore,
    logService: mock()
  }))
})

describe(nameof(AggregateLivestreamService, 'getAggregateLivestreams'), () => {
  // for consistency and ease of testing we deal only with yt livestreams
  beforeEach(() => {
    mockLivestreamStore.getTwitchLivestreams.calledWith(streamerId, expect.any(Number)).mockResolvedValue([])
  })

  test('Creates separate aggregate livestreams if not connected', async () => {
    mockLivestreamStore.getYoutubeLivestreams.calledWith(streamerId, 0).mockResolvedValue(cast<YoutubeLivestream[]>([
      { id: 1, start: data.time1, end: data.time2 },
      { id: 2, start: data.time3, end: data.time4 },
      { id: 3, start: data.time5, end: null }
    ]))

    const result = await aggregateLivestreamService.getAggregateLivestreams(streamerId, 0)

    expect(result).toEqual(expectObjectDeep(result, [
      { startTime: data.time1, endTime: data.time2, livestreams: [{ id: 1 }] },
      { startTime: data.time3, endTime: data.time4, livestreams: [{ id: 2 }] },
      { startTime: data.time5, endTime: null, livestreams: [{ id: 3 }] }
    ]))
  })

  test('Joins aggregate livestreams if connected (in-progress)', async () => {
    mockLivestreamStore.getYoutubeLivestreams.calledWith(streamerId, 0).mockResolvedValue(cast<YoutubeLivestream[]>([
      { id: 1, start: data.time1, end: data.time3 },
      { id: 2, start: data.time2, end: data.time4 },
      { id: 3, start: data.time3, end: null }
    ]))

    const result = await aggregateLivestreamService.getAggregateLivestreams(streamerId, 0)

    expect(result).toEqual(expectObjectDeep(result, [
      { startTime: data.time1, endTime: null, livestreams: [{ id: 1 }, { id: 2 }, { id: 3 }] }
    ]))
  })

  test('Joins aggregate livestreams if connected (ended)', async () => {
    mockLivestreamStore.getYoutubeLivestreams.calledWith(streamerId, 0).mockResolvedValue(cast<YoutubeLivestream[]>([
      { id: 1, start: data.time1, end: data.time3 },
      { id: 2, start: data.time2, end: data.time4 },
      { id: 3, start: data.time3, end: data.time5 }
    ]))

    const result = await aggregateLivestreamService.getAggregateLivestreams(streamerId, 0)

    expect(result).toEqual(expectObjectDeep(result, [
      { startTime: data.time1, endTime: data.time5, livestreams: [{ id: 1 }, { id: 2 }, { id: 3 }] }
    ]))
  })

  test('Mix of joined/separated aggregate livestreams', async () => {
    mockLivestreamStore.getYoutubeLivestreams.calledWith(streamerId, 0).mockResolvedValue(cast<YoutubeLivestream[]>([
      { id: 1, start: data.time1, end: data.time3 },
      { id: 2, start: data.time2, end: data.time4 },
      { id: 3, start: data.time5, end: null }
    ]))

    const result = await aggregateLivestreamService.getAggregateLivestreams(streamerId, 0)

    expect(result).toEqual(expectObjectDeep(result, [
      { startTime: data.time1, endTime: data.time4, livestreams: [{ id: 1 }, { id: 2 }] },
      { startTime: data.time5, endTime: null, livestreams: [{ id: 3 }] }
    ]))
  })

  test('Throws if there are multiple livestreams', async () => {
    mockLivestreamStore.getYoutubeLivestreams.calledWith(streamerId, 0).mockResolvedValue(cast<YoutubeLivestream[]>([
      { start: data.time1 },
      { start: data.time2 }
    ]))

    await expect(() => aggregateLivestreamService.getAggregateLivestreams(streamerId, 0)).rejects.toThrowError(ChatMateError)
  })

  test('Truncates livestreams if they start before the `since` timestamp.', async () => {
    const since = data.time3.getTime()

    // both of these streams start before the `since` time
    mockLivestreamStore.getYoutubeLivestreams.calledWith(streamerId, since).mockResolvedValue(cast<YoutubeLivestream[]>([
      { id: 1, start: data.time1, end: data.time4 },
      { id: 2, start: data.time2, end: null }
    ]))

    const result = await aggregateLivestreamService.getAggregateLivestreams(streamerId, since)

    expect(result).toEqual(expectObjectDeep(result, [
      { startTime: data.time3, endTime: null, livestreams: [{ id: 1 }, { id: 2 }] }
    ]))
  })
})

describe(nameof(AggregateLivestreamService, 'getLivestreamParticipation'), () => {
  test('Correctly marks participated livestreams', async () => {
    const anyUserIds = [1, 2, 3]
    const youtubeLivestream1 = cast<YoutubeLivestream>({ id: 1, liveId: '1' })
    const youtubeLivestream2 = cast<YoutubeLivestream>({ id: 2, liveId: '2' }) // not participated
    const youtubeLivestream3 = cast<YoutubeLivestream>({ id: 3, liveId: '3' })
    const twitchLivestream1 = cast<TwitchLivestream>({ id: 4 })
    const twitchLivestream2 = cast<TwitchLivestream>({ id: 5 }) // not participated
    const twitchLivestream3 = cast<TwitchLivestream>({ id: 6 }) // not participated
    const aggregateLivestream1 = new AggregateLivestream(data.time1, data.time2, [youtubeLivestream1, youtubeLivestream2, twitchLivestream1])
    const aggregateLivestream2 = new AggregateLivestream(data.time3, data.time4, [twitchLivestream2])
    const aggregateLivestream3 = new AggregateLivestream(data.time5, null, [youtubeLivestream3, twitchLivestream3])

    mockLivestreamStore.getYoutubeLivestreamParticipation.calledWith(streamerId, anyUserIds).mockResolvedValue(cast<YoutubeLivestreamParticipation[]>([
      { id: youtubeLivestream1.id, participated: true },
      { id: youtubeLivestream2.id, participated: false },
      { id: youtubeLivestream3.id, participated: true }
    ]))
    mockLivestreamStore.getTwitchLivestreamParticipation.calledWith(streamerId, anyUserIds).mockResolvedValue(cast<TwitchLivestreamParticipation[]>([
      { id: twitchLivestream1.id, participated: true },
      { id: twitchLivestream2.id, participated: false },
      { id: twitchLivestream3.id, participated: false }
    ]))

    // replace the getAggregateLivestreams method with a mock so this test is simplified
    const hybridAggregateLivestreamService: MockProxy<AggregateLivestreamService> = mock()
    aggregateLivestreamService.getAggregateLivestreams = hybridAggregateLivestreamService.getAggregateLivestreams
    hybridAggregateLivestreamService.getAggregateLivestreams.calledWith(streamerId, 0).mockResolvedValue([aggregateLivestream1, aggregateLivestream2, aggregateLivestream3])

    const result = await aggregateLivestreamService.getLivestreamParticipation(streamerId, anyUserIds)

    expect(result).toEqual(expectObject(result, [
      { data: { hasParticipated: true }},
      { data: { hasParticipated: false }},
      { data: { hasParticipated: true }}
    ]))
  })
})
