import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { expectObject, nameof } from '@rebel/shared/testUtils'
import { single } from '@rebel/shared/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { YoutubeLivestream, YoutubeLiveViewers, TwitchLivestream, TwitchLiveViewers } from '@prisma/client'
import { addTime } from '@rebel/shared/util/datetime'
import { ChatMateError, DbError } from '@rebel/shared/util/error'

export default () => {
  const liveId1 = 'id1'
  const liveId2 = 'id2'
  const liveId3 = 'id3'
  const streamer1 = 1
  const streamer2 = 2

  let livestreamStore: LivestreamStore
  let db: Db
  let mockLogService: MockProxy<LogService>

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    mockLogService = mock<LogService>()

    livestreamStore = new LivestreamStore(new Dependencies({
      dbProvider,
      logService: mockLogService }))
    db = dbProvider.get()

    await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}})
    await db.streamer.create({ data: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }}}})
  }, DB_TEST_TIMEOUT)

  afterEach(() => {
    stopTestDb()
  })

  describe(nameof(LivestreamStore, 'addNewTwitchLivestream'), () => {
    test('Creates a new Twitch livestream for the streamer', async () => {
      await db.twitchLivestream.createMany({ data: [
        { streamerId: streamer1, start: data.time1, end: data.time2 },
        { streamerId: streamer2, start: data.time1, end: null }
      ]})

      const result = await livestreamStore.addNewTwitchLivestream(streamer1)

      await expectRowCount(db.twitchLivestream).toBe(3)
      expect(result).toEqual(expectObject(result, { streamerId: streamer1, start: expect.any(Date), end: null }))
    })

    test('Throws if a current livestream already exists', async () => {
      await db.twitchLivestream.create({ data: { streamerId: streamer1, start: data.time1 }})

      await expect(() => livestreamStore.addNewTwitchLivestream(streamer1)).rejects.toThrowError(ChatMateError)
    })
  })

  describe(nameof(LivestreamStore, 'deactivateYoutubeLivestream'), () => {
    test('Updates entry in the database', async () => {
      await db.youtubeLivestream.createMany({ data: [
        { liveId: liveId1, streamerId: streamer1, isActive: true },
        { liveId: liveId2, streamerId: streamer2, isActive: true }
      ]})

      await livestreamStore.deactivateYoutubeLivestream(streamer2)

      const livestream1 = await db.youtubeLivestream.findUnique({ where: { liveId: liveId1 } })
      const livestream2 = await db.youtubeLivestream.findUnique({ where: { liveId: liveId2 } })
      expect(livestream1).toEqual(expectObject<YoutubeLivestream>({ liveId: liveId1, isActive: true, end: null }))
      expect(livestream2).toEqual(expectObject<YoutubeLivestream>({ liveId: liveId2, isActive: false, end: null }))
    })

    test('Ends the livestream if deactivating while live', async () => {
      await db.youtubeLivestream.createMany({ data: [
        { liveId: liveId1, streamerId: streamer1, isActive: true },
        { liveId: liveId2, streamerId: streamer2, isActive: true, start: data.time1 }
      ]})

      await livestreamStore.deactivateYoutubeLivestream(streamer2)

      const livestream1 = await db.youtubeLivestream.findUnique({ where: { liveId: liveId1 } })
      const livestream2 = await db.youtubeLivestream.findUnique({ where: { liveId: liveId2 } })
      expect(livestream1).toEqual(expectObject<YoutubeLivestream>({ liveId: liveId1, isActive: true, end: null }))
      expect(livestream2).toEqual(expectObject<YoutubeLivestream>({ liveId: liveId2, isActive: false, start: data.time1, end: expect.any(Date) }))
    })
  })

  describe(nameof(LivestreamStore, 'getActiveYoutubeLivestream'), () => {
    test(`Returns the streamer's currently active, public livestream`, async () => {
      await db.youtubeLivestream.createMany({ data: [
        { liveId: liveId1, streamerId: streamer1, isActive: false },
        { liveId: liveId2, streamerId: streamer1, isActive: true },
        { liveId: liveId3, streamerId: streamer2, isActive: true }
      ]})

      const result = await livestreamStore.getActiveYoutubeLivestream(streamer1)

      expect(result!.liveId).toBe(liveId2)
    })

    test('Returns null when no livestream is active', async () => {
      await db.youtubeLivestream.createMany({ data: [
        { liveId: liveId1, streamerId: streamer1, isActive: false },
        { liveId: liveId2, streamerId: streamer2, isActive: true }
      ]})

      const result = await livestreamStore.getActiveYoutubeLivestream(streamer1)

      expect(result).toBeNull()
    })
  })

  describe(nameof(LivestreamStore, 'getActiveYoutubeLivestreams'), () => {
    test('Returns all active youtube livestreams', async () => {
      await db.youtubeLivestream.createMany({ data: [
        { liveId: liveId1, streamerId: streamer1, isActive: false },
        { liveId: liveId2, streamerId: streamer1, isActive: true },
        { liveId: liveId3, streamerId: streamer2, isActive: true }
      ]})

      const result = await livestreamStore.getActiveYoutubeLivestreams()

      expect(result.length).toBe(2)
      expect(result[0].liveId).toBe(liveId2)
      expect(result[1].liveId).toBe(liveId3)
    })
  })

  describe(nameof(LivestreamStore, 'getCurrentTwitchLivestream'), () => {
    test('Returns the in-progress twitch stream', async () => {
      await db.twitchLivestream.createMany({ data: [
        { streamerId: streamer1, start: data.time1, end: data.time2 },
        { streamerId: streamer2, start: data.time3 },
        { streamerId: streamer1, start: data.time4 }
      ]})

      const result = await livestreamStore.getCurrentTwitchLivestream(streamer1)

      expect(result!.id).toBe(3)
    })

    test('Returns null if no stream is in progress', async () => {
      await db.twitchLivestream.createMany({ data: [
        { streamerId: streamer1, start: data.time1, end: data.time2 },
        { streamerId: streamer2, start: data.time3 }
      ]})

      const result = await livestreamStore.getCurrentTwitchLivestream(streamer1)

      expect(result).toBeNull()
    })
  })

  describe(nameof(LivestreamStore, 'getCurrentTwitchLivestreams'), () => {
    test('Returns in-progress Twitch streams', async () => {
      await db.twitchLivestream.createMany({ data: [
        { streamerId: streamer1, start: data.time1, end: data.time2 },
        { streamerId: streamer2, start: data.time3 },
        { streamerId: streamer1, start: data.time4 }
      ]})

      const result = await livestreamStore.getCurrentTwitchLivestreams()

      expect(result.map(l => l.id)).toEqual([2, 3])
    })
  })

  describe(nameof(LivestreamStore, 'getPreviousTwitchLivestream'), () => {
    test('Returns the previous livestream', async () => {
      await db.twitchLivestream.createMany({ data: [
        { streamerId: streamer1, start: data.time1, end: data.time2 },
        { streamerId: streamer1, start: data.time2, end: data.time3 },
        { streamerId: streamer1, start: data.time3, end: null },
        { streamerId: streamer2, start: data.time1, end: data.time5 }
      ]})

      const result = await livestreamStore.getPreviousTwitchLivestream(streamer1)

      expect(result!.id).toBe(2)
    })

    test('Returns null if the streamer has no previous livestream', async () => {
      await db.twitchLivestream.createMany({ data: [
        { streamerId: streamer1, start: data.time3, end: null },
        { streamerId: streamer2, start: data.time1, end: data.time5 }
      ]})

      const result = await livestreamStore.getPreviousTwitchLivestream(streamer1)

      expect(result).toBeNull()
    })
  })

  describe(nameof(LivestreamStore, 'getYoutubeLivestreams'), () => {
    test(`Gets the ordered list of the streamer's Youtube livestreams`, async () => {
      await db.youtubeLivestream.createMany({
        data: [
          { liveId: 'puS6DpPKZ3E', streamerId: streamer2, start: data.time3, end: null, isActive: true },
          { liveId: 'puS6DpPKZ3f', streamerId: streamer2, start: null, end: data.time3, isActive: true },
          { liveId: 'puS6DpPKZ3g', streamerId: streamer1, start: data.time2, end: data.time3, isActive: false },
          { liveId: 'puS6DpPKZ3h', streamerId: streamer2, start: data.time2, end: data.time3, isActive: false }
        ]
      })

      const result = await livestreamStore.getYoutubeLivestreams(streamer2, 0)

      expect(result.map(l => l.id)).toEqual([4, 1, 2])
    })

    test('Only returns livestreams since the given time', async () => {
      await db.youtubeLivestream.createMany({
        data: [
          { liveId: 'puS6DpPKZ3g', streamerId: streamer1, start: data.time1, end: data.time2, isActive: false },
          { liveId: 'puS6DpPKZ3h', streamerId: streamer1, start: data.time3, end: data.time4, isActive: false },
          { liveId: 'puS6DpPKZ3E', streamerId: streamer1, start: data.time5, end: null, isActive: true }
        ]
      })

      const result = await livestreamStore.getYoutubeLivestreams(streamer1, data.time3.getTime() + 1)

      expect(result.map(l => l.id)).toEqual([2, 3])
    })
  })

  describe(nameof(LivestreamStore, 'getTwitchLivestreams'), () => {
    test(`Gets the ordered list of the streamer's Twitch livestreams`, async () => {
      await db.twitchLivestream.createMany({ data: [
        { streamerId: streamer2, start: data.time2 },
        { streamerId: streamer1, start: data.time3, end: data.time4 },
        { streamerId: streamer1, start: data.time1 }
      ]})

      const result = await livestreamStore.getTwitchLivestreams(streamer1, 0)

      expect(result.map(l => l.id)).toEqual([3, 2])
    })

    test('Only returns livestreams since the given time', async () => {
      await db.twitchLivestream.createMany({ data: [
        { streamerId: streamer1, start: data.time1, end: data.time2 },
        { streamerId: streamer1, start: data.time3, end: data.time4 },
        { streamerId: streamer1, start: data.time5, end: null }
      ]})

      const result = await livestreamStore.getTwitchLivestreams(streamer1, data.time3.getTime() + 1)

      expect(result.map(l => l.id)).toEqual([2, 3])
    })
  })

  describe(nameof(LivestreamStore, 'getYoutubeTotalDaysLivestreamed'), () => {
    test('Calculates the total streaming time for all completed Youtube livestreams', async () => {
      await db.youtubeLivestream.createMany({ data: [
        { isActive: true, start: data.time1, end: data.time2, liveId: '1', streamerId: streamer1 },
        { isActive: true, start: data.time3, end: data.time4, liveId: '2', streamerId: streamer2 }
      ]})

      const result = await livestreamStore.getYoutubeTotalDaysLivestreamed(0)

      const expectedMs = data.time2.getTime() - data.time1.getTime() + data.time4.getTime() - data.time3.getTime()
      const expectedDays = expectedMs / 1000 / 3600 / 24
      expect(result).toBeCloseTo(expectedDays, 8)
    })

    test('Uses the current time as the end date for ongoing Youtube livestreams', async () => {
      const time = addTime(new Date(), 'days', -5)
      await db.youtubeLivestream.create({ data: { isActive: true, start: time, liveId: '1', streamerId: streamer1 }})

      const result = await livestreamStore.getYoutubeTotalDaysLivestreamed(0)

      expect(Math.round(result)).toBe(5)
    })

    test('Ignores Youtube livestreams that have not been started', async () => {
      await db.youtubeLivestream.create({ data: { isActive: true, liveId: '1', streamerId: streamer1 }})

      const result = await livestreamStore.getYoutubeTotalDaysLivestreamed(0)

      expect(result).toBe(0)
    })

    test('Ignores livestreams before the since date', async () => {
      await db.youtubeLivestream.create({ data: { isActive: true, start: data.time1, end: data.time2, liveId: '1', streamerId: streamer1 }})

      const result = await livestreamStore.getYoutubeTotalDaysLivestreamed(data.time3.getTime())

      expect(result).toBe(0)
    })

    test('Considers only the partial livestream if it the since time intersects an ongoing livestream', async () => {
      await db.youtubeLivestream.create({ data: { isActive: true, start: data.time1, end: data.time3, liveId: '1', streamerId: streamer1 }})

      const result = await livestreamStore.getYoutubeTotalDaysLivestreamed(data.time2.getTime())

      // if you get a different time here, it's likely that you haven't set your database timezone to UTC.
      // I still don't fully understand the problem, just change your timezone and shut up please.
      const expectedDays = (data.time3.getTime() - data.time2.getTime()) / 1000 / 3600 / 24
      expect(result).toBe(expectedDays)
    })
  })

  describe(nameof(LivestreamStore, 'getTwitchTotalDaysLivestreamed'), () => {
    test('Calculates the total streaming time for all completed Twitch livestreams', async () => {
      await db.twitchLivestream.createMany({ data: [
        { start: data.time1, end: data.time2, streamerId: streamer1 },
        { start: data.time3, end: data.time4, streamerId: streamer2 }
      ]})

      const result = await livestreamStore.getTwitchTotalDaysLivestreamed(0)

      const expectedMs = data.time2.getTime() - data.time1.getTime() + data.time4.getTime() - data.time3.getTime()
      const expectedDays = expectedMs / 1000 / 3600 / 24
      expect(result).toBeCloseTo(expectedDays, 8)
    })

    test('Uses the current time as the end date for ongoing Twitch livestreams', async () => {
      const time = addTime(new Date(), 'days', -5)
      await db.twitchLivestream.create({ data: { start: time, streamerId: streamer1 }})

      const result = await livestreamStore.getTwitchTotalDaysLivestreamed(0)

      expect(Math.round(result)).toBe(5)
    })

    test('Ignores livestreams before the since date', async () => {
      await db.twitchLivestream.create({ data: { start: data.time1, end: data.time2, streamerId: streamer1 }})

      const result = await livestreamStore.getTwitchTotalDaysLivestreamed(data.time3.getTime())

      expect(result).toBe(0)
    })

    test('Considers only the partial livestream if it the since time intersects an ongoing livestream', async () => {
      await db.twitchLivestream.create({ data: { start: data.time1, end: data.time3, streamerId: streamer1 }})

      const result = await livestreamStore.getTwitchTotalDaysLivestreamed(data.time2.getTime())

      expect(result).toBe((data.time3.getTime() - data.time2.getTime()) / 1000 / 3600 / 24)
    })
  })

  describe(nameof(LivestreamStore, 'setActiveYoutubeLivestream'), () => {
    test('Creates and sets new active Youtube livestream', async () => {
      // there is an active Youtube livestream for a different streamer - this should not affect the request for streamer 1
      await db.youtubeLivestream.create({ data: { liveId: liveId2, streamerId: streamer2, isActive: true }})

      const result = await livestreamStore.setActiveYoutubeLivestream(streamer1, liveId1)

      await expectRowCount(db.youtubeLivestream).toBe(2)
      const storedLivestreams = await db.youtubeLivestream.findMany()
      expect(storedLivestreams[1]).toEqual(expectObject<YoutubeLivestream>({ liveId: liveId1, streamerId: streamer1, isActive: true }))
      expect(result).toEqual(storedLivestreams[1])
    })

    test('Updates the existing Youtube livestream in the db', async () => {
      await db.youtubeLivestream.create({ data: { liveId: liveId1, streamerId: streamer1, isActive: false }})

      const result = await livestreamStore.setActiveYoutubeLivestream(streamer1, liveId1)

      const storedLivestream = single(await db.youtubeLivestream.findMany())
      expect(storedLivestream).toEqual(expectObject<YoutubeLivestream>({ liveId: liveId1, streamerId: streamer1, isActive: true }))
      expect(result).toEqual(storedLivestream)
    })

    test('Throws if there is already an active Youtube livestream', async () => {
      await db.youtubeLivestream.create({ data: { liveId: liveId1, streamerId: streamer1, isActive: true }})

      await expect(() => livestreamStore.setActiveYoutubeLivestream(streamer1, 'id2')).rejects.toThrowError(ChatMateError)
    })
  })

  describe(nameof(LivestreamStore, 'setYoutubeContinuationToken'), () => {
    test('Updates the continuation token for the given Youtube livestream', async () => {
      await db.youtubeLivestream.create({ data: { liveId: liveId1, streamerId: streamer1, isActive: true } })

      const stream = await livestreamStore.setYoutubeContinuationToken(liveId1, 'token')

      expect(stream!.continuationToken).toBe('token')
      expect((await db.youtubeLivestream.findFirst())!.continuationToken).toBe('token')
    })

    test('Throws if no Youtube livestream can be found with the given liveId', async () => {
      await expect(livestreamStore.setYoutubeContinuationToken('id', 'test')).rejects.toThrowError(DbError)
    })
  })

  describe(nameof(LivestreamStore, 'setYoutubeLivestreamTimes'), () => {
    test('Times are updated correctly for the specified Youtube livestream', async () => {
      const time = new Date()
      await db.youtubeLivestream.create({ data: { liveId: liveId1, streamerId: streamer1, isActive: true } })

      const returnedStream = await livestreamStore.setYoutubeLivestreamTimes(liveId1, { start: time, end: null })

      expect(returnedStream!.start).toEqual(time)
      expect(returnedStream!.end).toBeNull()

      const savedStream = (await db.youtubeLivestream.findFirst())!
      expect(savedStream.start).toEqual(time)
      expect(savedStream.end).toBeNull()
    })

    test('Throws if the Youtube livestream does not exist', async () => {
      await expect(livestreamStore.setYoutubeLivestreamTimes(liveId1, { start: null, end: null })).rejects.toThrowError(DbError)
    })
  })

  describe(nameof(LivestreamStore, 'setTwitchLivestreamTimes'), () => {
    test('Times are updated correctly for the specified Youtube livestream', async () => {
      const end = new Date()
      await db.twitchLivestream.create({ data: { streamerId: streamer1, start: data.time2 } })

      const returnedStream = await livestreamStore.setTwitchLivestreamTimes(1, { start: data.time2, end: end })

      expect(returnedStream!.start).toEqual(data.time2)
      expect(returnedStream!.end).toEqual(end)

      const savedStream = (await db.twitchLivestream.findFirst())!
      expect(savedStream.start).toEqual(data.time2)
      expect(savedStream.end).toEqual(end)
    })

    test('Throws if the Youtube livestream does not exist', async () => {
      await expect(livestreamStore.setTwitchLivestreamTimes(1, { start: data.time1, end: null })).rejects.toThrowError(DbError)
    })
  })

  describe(nameof(LivestreamStore, 'addYoutubeLiveViewCount'), () => {
    test('Correctly adds live viewer count', async () => {
      await db.youtubeLivestream.createMany({ data: [
        { liveId: liveId1, streamerId: streamer1, start: data.time3, createdAt: data.time3, isActive: true },
        { liveId: liveId2, streamerId: streamer2, start: data.time2, createdAt: data.time2, isActive: true }
      ]})
      const views = 5

      await livestreamStore.addYoutubeLiveViewCount(1, views)

      const storedLiveViewers = await db.youtubeLiveViewers.findFirst()
      expect(storedLiveViewers).toEqual(expectObject<YoutubeLiveViewers>({
        youtubeLivestreamId: 1,
        viewCount: views
      }))
    })
  })

  describe(nameof(LivestreamStore, 'addTwitchLiveViewCount'), () => {
    test('Correctly adds live viewer count', async () => {
      await db.twitchLivestream.createMany({ data: [
        { streamerId: streamer1, start: data.time3 },
        { streamerId: streamer2, start: data.time2 }
      ]})
      const views = 25

      await livestreamStore.addTwitchLiveViewCount(1, views)

      const storedLiveViewers = await db.twitchLiveViewers.findFirst()
      expect(storedLiveViewers).toEqual(expectObject<TwitchLiveViewers>({
        twitchLivestreamId: 1,
        viewCount: views
      }))
    })
  })

  describe(nameof(LivestreamStore, 'getLatestYoutubeLiveCount'), () => {
    let livestream1: YoutubeLivestream // streamer 1
    let livestream2: YoutubeLivestream // streamer 1

    beforeEach(async () => {
      livestream1 = await db.youtubeLivestream.create({ data: { liveId: 'id1', streamerId: streamer1, start: data.time1, createdAt: data.time1, isActive: false } })
      livestream2 = await db.youtubeLivestream.create({ data: { liveId: 'id2', streamerId: streamer1, start: data.time2, createdAt: data.time2, isActive: false } })
    })

    test('Returns null if no data exists for the specified livestream', async () => {
      await db.youtubeLiveViewers.createMany({ data: [
        { youtubeLivestreamId: livestream2.id, viewCount: 2 }
      ]})

      const result = await livestreamStore.getLatestYoutubeLiveCount(livestream1.id)

      expect(result).toBeNull()
    })

    test('Returns correct count and time for active livestream', async () => {
      const data1 = { time: data.time1, viewCount: 1 }
      const data2 = { time: data.time2, viewCount: 2 }
      await db.youtubeLiveViewers.createMany({ data: [
        { youtubeLivestreamId: livestream1.id, viewCount: data1.viewCount, time: data1.time },
        { youtubeLivestreamId: livestream1.id, viewCount: data2.viewCount, time: data2.time },
        { youtubeLivestreamId: livestream2.id, viewCount: 354, time: new Date() },
      ]})

      const result = await livestreamStore.getLatestYoutubeLiveCount(livestream1.id)

      expect(result).toEqual(data2)
    })
  })

  describe(nameof(LivestreamStore, 'getLatestTwitchLiveCount'), () => {
    let livestream1: TwitchLivestream // streamer 1
    let livestream2: TwitchLivestream // streamer 1

    beforeEach(async () => {
      livestream1 = await db.twitchLivestream.create({ data: { streamerId: streamer1, start: data.time1 } })
      livestream2 = await db.twitchLivestream.create({ data: { streamerId: streamer1, start: data.time2 } })
    })

    test('Returns null if no data exists for the specified livestream', async () => {
      await db.twitchLiveViewers.createMany({ data: [
        { twitchLivestreamId: livestream2.id, viewCount: 2 }
      ]})

      const result = await livestreamStore.getLatestTwitchLiveCount(livestream1.id)

      expect(result).toBeNull()
    })

    test('Returns correct count and time for active livestream', async () => {
      const data1 = { time: data.time1, viewCount: 1 }
      const data2 = { time: data.time2, viewCount: 2 }
      await db.twitchLiveViewers.createMany({ data: [
        { twitchLivestreamId: livestream1.id, viewCount: data1.viewCount, time: data1.time },
        { twitchLivestreamId: livestream1.id, viewCount: data2.viewCount, time: data2.time },
        { twitchLivestreamId: livestream2.id, viewCount: 354, time: new Date() },
      ]})

      const result = await livestreamStore.getLatestTwitchLiveCount(livestream1.id)

      expect(result).toEqual(data2)
    })
  })

  describe(nameof(LivestreamStore, 'getYoutubeLivestreamParticipation'), () => {
    const user1 = 1
    const user2 = 2
    const user3 = 3
    let inactiveLivestream1: YoutubeLivestream
    let inactiveLivestream2: YoutubeLivestream
    let activeLivestream1: YoutubeLivestream
    let activeLivestream2: YoutubeLivestream // other streamer

    beforeEach(async () => {
      inactiveLivestream1 = await db.youtubeLivestream.create({ data: { liveId: 'id1', streamerId: streamer1, start: data.time1, createdAt: data.time1, isActive: false } })
      inactiveLivestream2 = await db.youtubeLivestream.create({ data: { liveId: 'id2', streamerId: streamer1, start: data.time2, createdAt: data.time2, isActive: false } })
      activeLivestream1 = await db.youtubeLivestream.create({ data: { liveId: 'id3', streamerId: streamer1, start: data.time3, createdAt: data.time3, isActive: true } })
      activeLivestream2 = await db.youtubeLivestream.create({ data: { liveId: 'id4', streamerId: streamer2, start: data.time2, createdAt: data.time2, isActive: true } })
      await db.chatUser.createMany({ data: [{}, {}, {}]})

      // only used in third test case
      await db.chatMessage.createMany({ data: [
        { streamerId: streamer1, userId: 2, youtubeLivestreamId: 1, time: data.time1, externalId: 'id1.1' },
        { streamerId: streamer1, userId: 2, youtubeLivestreamId: 2, time: data.time2, externalId: 'id2.1' },
        { streamerId: streamer1, userId: 2, youtubeLivestreamId: 2, time: addTime(data.time2, 'seconds', 1), externalId: 'id3.1' },
      ]})
    })

    test('No participation', async () => {
      await db.chatMessage.createMany({ data: [
        {  streamerId: activeLivestream2.streamerId, userId: user1, youtubeLivestreamId: activeLivestream2.id, time: data.time1, externalId: 'id1' }, // correct user, wrong streamer
        {  streamerId: activeLivestream1.streamerId, userId: user2, youtubeLivestreamId: activeLivestream1.id, time: data.time1, externalId: 'id2' }, // wrong user, correct streamer
      ]})

      const result = await livestreamStore.getYoutubeLivestreamParticipation(streamer1, [user1])

      expect(result.length).toBe(3)
      expect(result.filter(ls => ls.participated).length).toBe(0)
    })

    test('Does not include chat messages not attached to a public livestream', async () => {
      await db.chatMessage.createMany({ data: [
        { streamerId: streamer1, userId: user1, youtubeLivestreamId: 1, time: data.time1, externalId: 'id1' },
        { streamerId: streamer1, userId: user1, youtubeLivestreamId: null, time: addTime(data.time1, 'seconds', 1), externalId: 'id2' }
      ]})

      const result = await livestreamStore.getYoutubeLivestreamParticipation(streamer1, [user1])

      expect(result.length).toBe(3)
      expect(result[0]).toEqual(expect.objectContaining({ participated: true, id: 1 }))
      expect(result[1]).toEqual(expect.objectContaining({ participated: false, id: 2 }))
      expect(result[2]).toEqual(expect.objectContaining({ participated: false, id: 3 }))
    })

    test('returns ordered streams where users participated', async () => {
      // in the beforeEach(), we already create chat messages
      // user1: livestream 1
      // user2: livestream 2
      await db.chatMessage.createMany({ data: [
        { streamerId: streamer1, userId: user3, youtubeLivestreamId: activeLivestream1.id, time: data.time3, externalId: 'id3' },
      ]})

      const result = await livestreamStore.getYoutubeLivestreamParticipation(streamer1, [user1, user2])

      expect(result.length).toBe(3)
      expect(result[0]).toEqual(expect.objectContaining({ participated: true, id: 1 }))
      expect(result[1]).toEqual(expect.objectContaining({ participated: true, id: 2 }))
      expect(result[2]).toEqual(expect.objectContaining({ participated: false, id: 3 }))
    })
  })

  describe(nameof(LivestreamStore, 'getTwitchLivestreamParticipation'), () => {
    const user1 = 1
    const user2 = 2
    const user3 = 3
    let inactiveLivestream1: TwitchLivestream
    let inactiveLivestream2: TwitchLivestream
    let activeLivestream1: TwitchLivestream
    let activeLivestream2: TwitchLivestream // other streamer

    beforeEach(async () => {
      inactiveLivestream1 = await db.twitchLivestream.create({ data: { streamerId: streamer1, start: data.time1, end: data.time2 } })
      inactiveLivestream2 = await db.twitchLivestream.create({ data: { streamerId: streamer1, start: data.time2, end: data.time3 } })
      activeLivestream1 = await db.twitchLivestream.create({ data: { streamerId: streamer1, start: data.time3 } })
      activeLivestream2 = await db.twitchLivestream.create({ data: { streamerId: streamer2, start: data.time2 } })
      await db.chatUser.createMany({ data: [{}, {}, {}]})

      // only used in third test case
      await db.chatMessage.createMany({ data: [
        { streamerId: streamer1, userId: 2, twitchLivestreamId: 1, time: data.time1, externalId: 'id1.1' },
        { streamerId: streamer1, userId: 2, twitchLivestreamId: 2, time: data.time2, externalId: 'id2.1' },
        { streamerId: streamer1, userId: 2, twitchLivestreamId: 2, time: addTime(data.time2, 'seconds', 1), externalId: 'id3.1' },
      ]})
    })

    test('No participation', async () => {
      await db.chatMessage.createMany({ data: [
        {  streamerId: activeLivestream2.streamerId, userId: user1, twitchLivestreamId: activeLivestream2.id, time: data.time1, externalId: 'id1' }, // correct user, wrong streamer
        {  streamerId: activeLivestream1.streamerId, userId: user2, twitchLivestreamId: activeLivestream1.id, time: data.time1, externalId: 'id2' }, // wrong user, correct streamer
      ]})

      const result = await livestreamStore.getTwitchLivestreamParticipation(streamer1, [user1])

      expect(result.length).toBe(3)
      expect(result.filter(ls => ls.participated).length).toBe(0)
    })

    test('Does not include chat messages not attached to a public livestream', async () => {
      await db.chatMessage.createMany({ data: [
        { streamerId: streamer1, userId: user1, twitchLivestreamId: 1, time: data.time1, externalId: 'id1' },
        { streamerId: streamer1, userId: user1, twitchLivestreamId: null, time: addTime(data.time1, 'seconds', 1), externalId: 'id2' }
      ]})

      const result = await livestreamStore.getTwitchLivestreamParticipation(streamer1, [user1])

      expect(result.length).toBe(3)
      expect(result[0]).toEqual(expect.objectContaining({ participated: true, id: 1 }))
      expect(result[1]).toEqual(expect.objectContaining({ participated: false, id: 2 }))
      expect(result[2]).toEqual(expect.objectContaining({ participated: false, id: 3 }))
    })

    test('returns ordered streams where users participated', async () => {
      // in the beforeEach(), we already create chat messages
      // user1: livestream 1
      // user2: livestream 2
      await db.chatMessage.createMany({ data: [
        { streamerId: streamer1, userId: user3, twitchLivestreamId: activeLivestream1.id, time: data.time3, externalId: 'id3' },
      ]})

      const result = await livestreamStore.getTwitchLivestreamParticipation(streamer1, [user1, user2])

      expect(result.length).toBe(3)
      expect(result[0]).toEqual(expect.objectContaining({ participated: true, id: 1}))
      expect(result[1]).toEqual(expect.objectContaining({ participated: true, id: 2}))
      expect(result[2]).toEqual(expect.objectContaining({ participated: false, id: 3}))
    })
  })
}
