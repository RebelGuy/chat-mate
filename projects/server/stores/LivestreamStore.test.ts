import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { expectObject, nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { Livestream } from '@prisma/client'

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
        { liveId: liveId1, streamerId: streamer1, type: 'publicLivestream', isActive: true },
        { liveId: liveId2, streamerId: streamer2, type: 'publicLivestream', isActive: true }
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
        { liveId: liveId1, streamerId: streamer1, type: 'publicLivestream', isActive: false },
        { liveId: liveId2, streamerId: streamer1, type: 'publicLivestream', isActive: true },
        { liveId: liveId3, streamerId: streamer2, type: 'publicLivestream', isActive: true }
      ]})

      const result = await livestreamStore.getActiveLivestream(streamer1)

      expect(result!.liveId).toBe(liveId2)
    })

    test('returns null when no livestream is active', async () => {
      await db.livestream.createMany({ data: [
        { liveId: liveId1, streamerId: streamer1, type: 'publicLivestream', isActive: false },
        { liveId: liveId2, streamerId: streamer2, type: 'publicLivestream', isActive: true }
      ]})

      const result = await livestreamStore.getActiveLivestream(streamer1)

      expect(result).toBeNull()
    })
  })

  describe(nameof(LivestreamStore, 'getActiveLivestreams'), () => {
    test('returns all active, public livestreams', async () => {
      await db.livestream.createMany({ data: [
        { liveId: liveId1, streamerId: streamer1, type: 'publicLivestream', isActive: false },
        { liveId: liveId2, streamerId: streamer1, type: 'publicLivestream', isActive: true },
        { liveId: liveId3, streamerId: streamer2, type: 'publicLivestream', isActive: true }
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
          { liveId: 'puS6DpPKZ3E', streamerId: streamer2, type: 'publicLivestream', start: data.time3, end: null, isActive: true },
          { liveId: 'puS6DpPKZ3f', streamerId: streamer2, type: 'publicLivestream', start: null, end: data.time3, isActive: true },
          { liveId: 'puS6DpPKZ3g', streamerId: streamer1, type: 'publicLivestream', start: data.time2, end: data.time3, isActive: false },
          { liveId: 'puS6DpPKZ3h', streamerId: streamer2, type: 'publicLivestream', start: data.time2, end: data.time3, isActive: false }
        ],
      })

      const result = await livestreamStore.getLivestreams(streamer2)

      expect(result.map(l => l.id)).toEqual([4, 1, 2])
    })
  })

  describe(nameof(LivestreamStore, 'setActiveLivestream'), () => {
    test('creates and sets new active livestream', async () => {
      // there is an active livestream for a different streamer - this should affect the request for streamer 1
      await db.livestream.create({ data: { liveId: liveId2, streamerId: streamer2, type: 'publicLivestream', isActive: true }})

      const result = await livestreamStore.setActiveLivestream(streamer1, liveId1, 'publicLivestream')

      await expectRowCount(db.livestream).toBe(2)
      const storedLivestreams = await db.livestream.findMany()
      expect(storedLivestreams[1]).toEqual(expectObject<Livestream>({ liveId: liveId1, streamerId: streamer1, isActive: true }))
      expect(result).toEqual(storedLivestreams[1])
    })

    test('updates existing livestream in the db', async () => {
      await db.livestream.create({ data: { liveId: liveId1, streamerId: streamer1, type: 'publicLivestream', isActive: false }})

      const result = await livestreamStore.setActiveLivestream(streamer1, liveId1, 'publicLivestream')

      const storedLivestream = single(await db.livestream.findMany())
      expect(storedLivestream).toEqual(expectObject<Livestream>({ liveId: liveId1, streamerId: streamer1, isActive: true }))
      expect(result).toEqual(storedLivestream)
    })

    test('throws if there is already an active livestream', async () => {
      await db.livestream.create({ data: { liveId: liveId1, streamerId: streamer1, type: 'publicLivestream', isActive: true }})

      await expect(() => livestreamStore.setActiveLivestream(streamer1, 'id2', 'publicLivestream')).rejects.toThrow()
    })
  })

  describe(nameof(LivestreamStore, 'setContinuationToken'), () => {
    test('continuation token is updated for active livestream', async () => {
      await db.livestream.create({ data: { liveId: liveId1, streamerId: streamer1, isActive: true, type: 'publicLivestream' } })

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
      await db.livestream.create({ data: { liveId: liveId1, streamerId: streamer1, isActive: true, type: 'publicLivestream' } })

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
}
