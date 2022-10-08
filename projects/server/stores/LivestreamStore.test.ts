import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'

export default () => {
  const liveId1 = 'id1'
  const liveId2 = 'id2'
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
  }, DB_TEST_TIMEOUT)

  afterEach(() => {
    stopTestDb()
  })

  describe(nameof(LivestreamStore, 'deactivateLivestream'), () => {
    test('updates entry in the database and clears cache', async () => {
      await db.livestream.create({ data: { liveId: liveId1, type: 'publicLivestream', isActive: true }})

      await livestreamStore.deactivateLivestream()

      const storedLivestream = single(await db.livestream.findMany())
      expect(storedLivestream).toEqual(expect.objectContaining({ liveId: liveId1, isActive: false }))
    })
  })

  describe(nameof(LivestreamStore, 'getActiveLivestream'), () => {
    test('returns the currently active, public livestream', async () => {
      await db.livestream.createMany({ data: [
        { liveId: liveId1, type: 'publicLivestream', isActive: false },
        { liveId: liveId2, type: 'publicLivestream', isActive: true }
      ]})

      const result = await livestreamStore.getActiveLivestream()

      expect(result?.liveId).toBe(liveId2)
    })

    test('returns null when no livestream is active', async () => {
      await db.livestream.createMany({ data: [
        { liveId: liveId1, type: 'publicLivestream', isActive: false },
        { liveId: liveId2, type: 'publicLivestream', isActive: false }
      ]})

      const result = await livestreamStore.getActiveLivestream()

      expect(result).toBeNull()
    })
  })

  describe(nameof(LivestreamStore, 'getLivestreams'), () => {
    test('gets the ordered list of livestreams', async () => {
      await db.livestream.createMany({
        data: [
          { liveId: 'puS6DpPKZ3E', type: 'publicLivestream', start: data.time3, end: null, isActive: true },
          { liveId: 'puS6DpPKZ3f', type: 'publicLivestream', start: null, end: data.time3, isActive: true },
          { liveId: 'puS6DpPKZ3g', type: 'publicLivestream', start: data.time2, end: data.time3, isActive: false }
        ],
      })

      const result = await livestreamStore.getLivestreams()

      expect(result.map(l => l.id)).toEqual([3, 1, 2])
    })
  })

  describe(nameof(LivestreamStore, 'setActiveLivestream'), () => {
    test('creates and sets new active livestream', async () => {
      const result = await livestreamStore.setActiveLivestream(liveId1, 'publicLivestream')

      const storedLivestream = single(await db.livestream.findMany())
      expect(storedLivestream).toEqual(expect.objectContaining({ liveId: liveId1, isActive: true }))
      expect(result).toEqual(storedLivestream)
    })

    test('updates existing livestream in the db', async () => {
      await db.livestream.create({ data: { liveId: liveId1, type: 'publicLivestream', isActive: false }})

      const result = await livestreamStore.setActiveLivestream(liveId1, 'publicLivestream')

      const storedLivestream = single(await db.livestream.findMany())
      expect(storedLivestream).toEqual(expect.objectContaining({ liveId: liveId1, isActive: true }))
      expect(result).toEqual(storedLivestream)
    })

    test('throws if there is already an active livestream', async () => {
      await db.livestream.create({ data: { liveId: liveId1, type: 'publicLivestream', isActive: true }})

      await expect(() => livestreamStore.setActiveLivestream('id2', 'publicLivestream')).rejects.toThrow()
    })
  })

  describe(nameof(LivestreamStore, 'setContinuationToken'), () => {
    test('continuation token is updated for active livestream', async () => {
      await db.livestream.create({ data: { liveId: liveId1, isActive: true, type: 'publicLivestream' } })

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
      await db.livestream.create({ data: { liveId: liveId1, isActive: true, type: 'publicLivestream' } })

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
