import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { expectObject, nameof } from '@rebel/shared/testUtils'
import { single } from '@rebel/shared/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { Livestream, LiveViewers } from '@prisma/client'
import { addTime } from '@rebel/shared/util/datetime'

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

  describe(nameof(LivestreamStore, 'deactivateLivestream'), () => {
    test('updates entry in the database and clears cache', async () => {
      await db.livestream.createMany({ data: [
        { liveId: liveId1, streamerId: streamer1, isActive: true },
        { liveId: liveId2, streamerId: streamer2, isActive: true }
      ]})

      await livestreamStore.deactivateLivestream(streamer2)

      const livestream1 = await db.livestream.findUnique({ where: { liveId: liveId1 } })
      const livestream2 = await db.livestream.findUnique({ where: { liveId: liveId2 } })
      expect(livestream1).toEqual(expectObject<Livestream>({ liveId: liveId1, isActive: true }))
      expect(livestream2).toEqual(expectObject<Livestream>({ liveId: liveId2, isActive: false }))
    })
  })

  describe(nameof(LivestreamStore, 'getActiveLivestream'), () => {
    test(`returns the streamer's currently active, public livestream`, async () => {
      await db.livestream.createMany({ data: [
        { liveId: liveId1, streamerId: streamer1, isActive: false },
        { liveId: liveId2, streamerId: streamer1, isActive: true },
        { liveId: liveId3, streamerId: streamer2, isActive: true }
      ]})

      const result = await livestreamStore.getActiveLivestream(streamer1)

      expect(result!.liveId).toBe(liveId2)
    })

    test('returns null when no livestream is active', async () => {
      await db.livestream.createMany({ data: [
        { liveId: liveId1, streamerId: streamer1, isActive: false },
        { liveId: liveId2, streamerId: streamer2, isActive: true }
      ]})

      const result = await livestreamStore.getActiveLivestream(streamer1)

      expect(result).toBeNull()
    })
  })

  describe(nameof(LivestreamStore, 'getActiveLivestreams'), () => {
    test('returns all active, public livestreams', async () => {
      await db.livestream.createMany({ data: [
        { liveId: liveId1, streamerId: streamer1, isActive: false },
        { liveId: liveId2, streamerId: streamer1, isActive: true },
        { liveId: liveId3, streamerId: streamer2, isActive: true }
      ]})

      const result = await livestreamStore.getActiveLivestreams()

      expect(result.length).toBe(2)
      expect(result[0].liveId).toBe(liveId2)
      expect(result[1].liveId).toBe(liveId3)
    })
  })

  describe(nameof(LivestreamStore, 'getLivestreams'), () => {
    test(`gets the ordered list of the streamer's livestreams`, async () => {
      await db.livestream.createMany({
        data: [
          { liveId: 'puS6DpPKZ3E', streamerId: streamer2, start: data.time3, end: null, isActive: true },
          { liveId: 'puS6DpPKZ3f', streamerId: streamer2, start: null, end: data.time3, isActive: true },
          { liveId: 'puS6DpPKZ3g', streamerId: streamer1, start: data.time2, end: data.time3, isActive: false },
          { liveId: 'puS6DpPKZ3h', streamerId: streamer2, start: data.time2, end: data.time3, isActive: false }
        ],
      })

      const result = await livestreamStore.getLivestreams(streamer2)

      expect(result.map(l => l.id)).toEqual([4, 1, 2])
    })
  })

  describe(nameof(LivestreamStore, 'getTotalDaysLivestreamed'), () => {
    test('Calculates the total streaming time for all completed livestreams', async () => {
      await db.livestream.createMany({ data: [
        { isActive: true, start: data.time1, end: data.time2, liveId: '1', streamerId: streamer1 },
        { isActive: true, start: data.time3, end: data.time4, liveId: '2', streamerId: streamer2 }
      ]})

      const result = await livestreamStore.getTotalDaysLivestreamed()

      const expectedMs = data.time2.getTime() - data.time1.getTime() + data.time4.getTime() - data.time3.getTime()
      const expectedDays = expectedMs / 1000 / 3600 / 24
      expect(result).toBeCloseTo(expectedDays, 8)
    })

    test('Uses the current time as the end date for ongoing livestreams', async () => {
      const time = addTime(new Date(), 'days', -5)
      await db.livestream.create({ data: { isActive: true, start: time, liveId: '1', streamerId: streamer1 }})

      const result = await livestreamStore.getTotalDaysLivestreamed()

      expect(Math.round(result)).toBe(5)
    })

    test('Ignored livestreams that have not been started', async () => {
      await db.livestream.create({ data: { isActive: true, liveId: '1', streamerId: streamer1 }})

      const result = await livestreamStore.getTotalDaysLivestreamed()

      expect(result).toBe(0)
    })
  })

  describe(nameof(LivestreamStore, 'setActiveLivestream'), () => {
    test('creates and sets new active livestream', async () => {
      // there is an active livestream for a different streamer - this should affect the request for streamer 1
      await db.livestream.create({ data: { liveId: liveId2, streamerId: streamer2, isActive: true }})

      const result = await livestreamStore.setActiveLivestream(streamer1, liveId1)

      await expectRowCount(db.livestream).toBe(2)
      const storedLivestreams = await db.livestream.findMany()
      expect(storedLivestreams[1]).toEqual(expectObject<Livestream>({ liveId: liveId1, streamerId: streamer1, isActive: true }))
      expect(result).toEqual(storedLivestreams[1])
    })

    test('updates existing livestream in the db', async () => {
      await db.livestream.create({ data: { liveId: liveId1, streamerId: streamer1, isActive: false }})

      const result = await livestreamStore.setActiveLivestream(streamer1, liveId1)

      const storedLivestream = single(await db.livestream.findMany())
      expect(storedLivestream).toEqual(expectObject<Livestream>({ liveId: liveId1, streamerId: streamer1, isActive: true }))
      expect(result).toEqual(storedLivestream)
    })

    test('throws if there is already an active livestream', async () => {
      await db.livestream.create({ data: { liveId: liveId1, streamerId: streamer1, isActive: true }})

      await expect(() => livestreamStore.setActiveLivestream(streamer1, 'id2')).rejects.toThrow()
    })
  })

  describe(nameof(LivestreamStore, 'setContinuationToken'), () => {
    test('continuation token is updated for active livestream', async () => {
      await db.livestream.create({ data: { liveId: liveId1, streamerId: streamer1, isActive: true } })

      const stream = await livestreamStore.setContinuationToken(liveId1, 'token')

      expect(stream!.continuationToken).toBe('token')
      expect((await db.livestream.findFirst())!.continuationToken).toBe('token')
    })

    test('throws if invalid id', async () => {
      await expect(livestreamStore.setContinuationToken('id', 'test')).rejects.toThrow()
    })
  })

  describe(nameof(LivestreamStore, 'setTimes'), () => {
    test('times are updated correctly for active livestream', async () => {
      const time = new Date()
      await db.livestream.create({ data: { liveId: liveId1, streamerId: streamer1, isActive: true } })

      const returnedStream = await livestreamStore.setTimes(liveId1, { start: time, end: null })

      expect(returnedStream!.start).toEqual(time)
      expect(returnedStream!.end).toBeNull()

      const savedStream = (await db.livestream.findFirst())!
      expect(savedStream.start).toEqual(time)
      expect(savedStream.end).toBeNull()
    })

    test('throws if livestream not yet created', async () => {
      await expect(livestreamStore.setTimes(liveId1, { start: null, end: null })).rejects.toThrow()
    })
  })

  describe(nameof(LivestreamStore, 'addLiveViewCount'), () => {
    test('correctly adds live viewer count', async () => {
      const inactiveLivestream1 = await db.livestream.create({ data: { liveId: 'id1', streamerId: streamer1, start: data.time1, createdAt: data.time1, isActive: false } })
      const inactiveLivestream2 = await db.livestream.create({ data: { liveId: 'id2', streamerId: streamer1, start: data.time2, createdAt: data.time2, isActive: false } })
      const activeLivestream1 = await db.livestream.create({ data: { liveId: 'id3', streamerId: streamer1, start: data.time3, createdAt: data.time3, isActive: true } })
      const activeLivestream2 = await db.livestream.create({ data: { liveId: 'id4', streamerId: streamer2, start: data.time2, createdAt: data.time2, isActive: true } })
      const youtubeViews = 5
      const twitchViews = 2

      await livestreamStore.addLiveViewCount(activeLivestream1.id, youtubeViews, twitchViews)

      const dbContents = await db.liveViewers.findFirst()
      expect(dbContents).toEqual(expectObject<LiveViewers>({
        livestreamId: activeLivestream1.id,
        youtubeViewCount: youtubeViews,
        twitchViewCount: twitchViews
      }))
    })
  })

  describe(nameof(LivestreamStore, 'getLatestLiveCount'), () => {
    let inactiveLivestream1: Livestream
    let inactiveLivestream2: Livestream
    let activeLivestream1: Livestream
    let activeLivestream2: Livestream

    beforeEach(async () => {
      inactiveLivestream1 = await db.livestream.create({ data: { liveId: 'id1', streamerId: streamer1, start: data.time1, createdAt: data.time1, isActive: false } })
      inactiveLivestream2 = await db.livestream.create({ data: { liveId: 'id2', streamerId: streamer1, start: data.time2, createdAt: data.time2, isActive: false } })
      activeLivestream1 = await db.livestream.create({ data: { liveId: 'id3', streamerId: streamer1, start: data.time3, createdAt: data.time3, isActive: true } })
      activeLivestream2 = await db.livestream.create({ data: { liveId: 'id4', streamerId: streamer2, start: data.time2, createdAt: data.time2, isActive: true } })
    })

    test('returns null if no data exists for active livestream', async () => {
      await db.liveViewers.createMany({ data: [
        { livestreamId: inactiveLivestream1.id, youtubeViewCount: 2, twitchViewCount: 5 },
        { livestreamId: activeLivestream2.id, youtubeViewCount: 2, twitchViewCount: 5 }
      ]})

      const result = await livestreamStore.getLatestLiveCount(activeLivestream1.id)

      expect(result).toBeNull()
    })

    test('returns null if there is no active livestream', async () => {
      // todo: this will probably fail, but honestly it should be the caller's responsibility to only
      // provide the id of an active livestream. maybe make a note in the method summary and check the callers?
      const result = await livestreamStore.getLatestLiveCount(inactiveLivestream1.id)

      expect(result).toBeNull()
    })

    test('returns correct count and time for active livestream', async () => {
      const data1 = { time: data.time1, viewCount: 1, twitchViewCount: 3 }
      const data2 = { time: data.time2, viewCount: 2, twitchViewCount: 4 }
      await db.liveViewers.create({ data: {
        livestreamId: activeLivestream1.id,
        youtubeViewCount: data1.viewCount,
        twitchViewCount: data1.twitchViewCount,
        time: data1.time
      }})
      await db.liveViewers.create({ data: {
        livestreamId: activeLivestream1.id,
        youtubeViewCount: data2.viewCount,
        twitchViewCount: data2.twitchViewCount,
        time: data2.time
      }})

      const result = await livestreamStore.getLatestLiveCount(activeLivestream1.id)

      expect(result).toEqual(data2)
    })
  })

  describe(nameof(LivestreamStore, 'getLivestreamParticipation'), () => {
    const user1 = 1
    const user2 = 2
    const user3 = 3
    let inactiveLivestream1: Livestream
    let inactiveLivestream2: Livestream
    let activeLivestream1: Livestream
    let activeLivestream2: Livestream

    beforeEach(async () => {
      inactiveLivestream1 = await db.livestream.create({ data: { liveId: 'id1', streamerId: streamer1, start: data.time1, createdAt: data.time1, isActive: false } })
      inactiveLivestream2 = await db.livestream.create({ data: { liveId: 'id2', streamerId: streamer1, start: data.time2, createdAt: data.time2, isActive: false } })
      activeLivestream1 = await db.livestream.create({ data: { liveId: 'id3', streamerId: streamer1, start: data.time3, createdAt: data.time3, isActive: true } })
      activeLivestream2 = await db.livestream.create({ data: { liveId: 'id4', streamerId: streamer2, start: data.time2, createdAt: data.time2, isActive: true } })
      await db.chatUser.createMany({ data: [{}, {}, {}]})

      await db.youtubeChannel.createMany({ data: [{ userId: user1, youtubeId: data.youtubeChannel1 }, { userId: user2, youtubeId: data.youtubeChannel2 }]})
      await db.twitchChannel.createMany({ data: [{ userId: user1, twitchId: data.twitchChannel3 }, { userId: user2, twitchId: data.twitchChannel4 }]})

      // irrelevant data to make for more realistic setup - we only test things relating to channel1/twitchChannel3/user1/user2
      await db.chatMessage.createMany({ data: [
        { streamerId: streamer1, userId: 2, livestreamId: 1, time: data.time1, externalId: 'id1.1' },
        { streamerId: streamer1, userId: 2, livestreamId: 2, time: data.time2, externalId: 'id2.1' },
        { streamerId: streamer1, userId: 2, livestreamId: 2, time: addTime(data.time2, 'seconds', 1), externalId: 'id3.1' },
      ]})
    })

    test('no participation', async () => {
      await db.chatMessage.createMany({ data: [
        {  streamerId: activeLivestream2.streamerId, userId: user1, livestreamId: activeLivestream2.id, time: data.time1, externalId: 'id1' }, // correct user, wrong streamer
        {  streamerId: activeLivestream1.streamerId, userId: user2, livestreamId: activeLivestream1.id, time: data.time1, externalId: 'id2' }, // wrong user, correct streamer
      ]})

      const result = await livestreamStore.getLivestreamParticipation(streamer1, [user1])

      expect(result.length).toBe(3)
      expect(result.filter(ls => ls.participated).length).toBe(0)
    })

    test('does not include chat messages not attached to a public livestream', async () => {
      await db.chatMessage.createMany({ data: [
        { streamerId: streamer1, userId: user1, livestreamId: 1, time: data.time1, externalId: 'id1' },
        { streamerId: streamer1, userId: user1, livestreamId: null, time: addTime(data.time1, 'seconds', 1), externalId: 'id2' }
      ]})

      const result = await livestreamStore.getLivestreamParticipation(streamer1, [user1])

      expect(result.length).toBe(3)
      expect(result[0]).toEqual(expect.objectContaining({ participated: true, id: 1}))
      expect(result[1]).toEqual(expect.objectContaining({ participated: false, id: 2}))
      expect(result[2]).toEqual(expect.objectContaining({ participated: false, id: 3}))
    })

    test('returns ordered streams where users participated', async () => {
      // in the beforeEach(), we already create chat messages
      // user1: livestream 1
      // user2: livestream 2
      await db.chatMessage.createMany({ data: [
        { streamerId: streamer1, userId: user3, livestreamId: activeLivestream1.id, time: data.time3, externalId: 'id3' },
      ]})

      const result = await livestreamStore.getLivestreamParticipation(streamer1, [user1, user2])

      expect(result.length).toBe(3)
      expect(result[0]).toEqual(expect.objectContaining({ participated: true, id: 1}))
      expect(result[1]).toEqual(expect.objectContaining({ participated: true, id: 2}))
      expect(result[2]).toEqual(expect.objectContaining({ participated: false, id: 3}))
    })
  })
}
