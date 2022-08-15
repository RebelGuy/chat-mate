import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'

export default () => {
  const liveId = 'id1'
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

  describe(nameof(LivestreamStore, 'initialise'), () => {
    test('stores null if no active livestream in database', async () => {
      await db.livestream.create({ data: { liveId: 'id1', type: 'publicLivestream', isActive: false }})

      await livestreamStore.initialise()

      expect(livestreamStore.activeLivestream).toBeNull()
    })

    test('existing livestream returned', async () => {
      await db.livestream.createMany({data: [
        { liveId: 'id1', type: 'publicLivestream', isActive: true },
        { liveId: 'id2', type: 'publicLivestream', isActive: false }
      ] })

      await livestreamStore.initialise()

      expect(livestreamStore.activeLivestream!.liveId).toBe('id1')
    })
  })

  describe(nameof(LivestreamStore, 'deactivateLivestream'), () => {
    test('updates entry in the database and clears cache', async () => {
      await db.livestream.create({ data: { liveId, type: 'publicLivestream', isActive: true }})
      await livestreamStore.initialise()

      expect(livestreamStore.activeLivestream!.liveId).toBe(liveId)

      await livestreamStore.deactivateLivestream()

      const storedLivestream = single(await db.livestream.findMany())
      expect(storedLivestream).toEqual(expect.objectContaining({ liveId, isActive: false }))
      expect(livestreamStore.activeLivestream).toBeNull()
    })
  })

  describe(nameof(LivestreamStore, 'setActiveLivestream'), () => {
    test('creates and sets new active livestream', async () => {
      await livestreamStore.initialise()

      expect(livestreamStore.activeLivestream).toBeNull()

      const result = await livestreamStore.setActiveLivestream(liveId, 'publicLivestream')

      expect(livestreamStore.activeLivestream).toEqual(result)

      const storedLivestream = single(await db.livestream.findMany())
      expect(storedLivestream).toEqual(expect.objectContaining({ liveId, isActive: true }))
      expect(result).toEqual(storedLivestream)
    })

    test('updates existing livestream in the db', async () => {
      await db.livestream.create({ data: { liveId, type: 'publicLivestream', isActive: false }})
      await livestreamStore.initialise()
      expect(livestreamStore.activeLivestream).toBeNull()

      const result = await livestreamStore.setActiveLivestream(liveId, 'publicLivestream')

      expect(livestreamStore.activeLivestream).toEqual(result)

      const storedLivestream = single(await db.livestream.findMany())
      expect(storedLivestream).toEqual(expect.objectContaining({ liveId, isActive: true }))
      expect(result).toEqual(storedLivestream)
    })

    test('throws if there is already an active livestream', async () => {
      await db.livestream.create({ data: { liveId, type: 'publicLivestream', isActive: true }})
      await livestreamStore.initialise()
      expect(livestreamStore.activeLivestream).not.toBeNull()

      await expect(() => livestreamStore.setActiveLivestream('id2', 'publicLivestream')).rejects.toThrow()
    })
  })

  describe(nameof(LivestreamStore, 'setContinuationToken'), () => {
    test('continuation token is updated for active livestream', async () => {
      await db.livestream.create({ data: { liveId, isActive: true, type: 'publicLivestream' } })
      await livestreamStore.initialise()

      const stream = await livestreamStore.setContinuationToken(liveId, 'token')

      expect(stream!.continuationToken).toBe('token')
      expect((await db.livestream.findFirst())!.continuationToken).toBe('token')
    })

    test('throws if invalid id', async () => {
      await expect(livestreamStore.setContinuationToken('id', 'test')).rejects.toThrow()
    })

    test('Returns null if livestream is no longer active', async () => {
      await db.livestream.create({ data: { liveId, isActive: false, type: 'publicLivestream' } })
      await livestreamStore.initialise()

      const result = await livestreamStore.setContinuationToken(liveId, 'token')

      expect(result).toBeNull()
    })
  })

  describe(nameof(LivestreamStore, 'setTimes'), () => {
    test('times are updated correctly for active livestream', async () => {
      const time = new Date()
      await db.livestream.create({ data: { liveId, isActive: true, type: 'publicLivestream' } })
      await livestreamStore.initialise()

      const returnedStream = await livestreamStore.setTimes(liveId, { start: time, end: null })

      expect(returnedStream!.start).toEqual(time)
      expect(returnedStream!.end).toBeNull()

      const savedStream = (await db.livestream.findFirst())!
      expect(savedStream.start).toEqual(time)
      expect(savedStream.end).toBeNull()
    })

    test('throws if livestream not yet created', async () => {
      await expect(livestreamStore.setTimes(liveId, { start: null, end: null })).rejects.toThrow()
    })

    test('Returns null if livestream is no longer active', async () => {
      await db.livestream.create({ data: { liveId, isActive: false, type: 'publicLivestream' } })
      await livestreamStore.initialise()

      const result = await livestreamStore.setTimes(liveId, { start: null, end: null })

      expect(result).toBeNull()
    })
  })

  describe(nameof(LivestreamStore, 'activeLivestream'), () => {
    test('returns created livestream', async () => {
      await db.livestream.create({ data: { liveId, continuationToken: 'token1', isActive: true, type: 'publicLivestream' } })
      await livestreamStore.initialise()

      const stream = livestreamStore.activeLivestream

      expect(stream).toEqual(expect.objectContaining({ liveId, continuationToken: 'token1' }))
    })

    test('returns updated livestream', async () => {
      await db.livestream.create({ data: { liveId, continuationToken: 'token1', isActive: true, type: 'publicLivestream' } })
      await livestreamStore.initialise()

      await livestreamStore.setContinuationToken(liveId, 'token2')
      const stream = livestreamStore.activeLivestream

      expect(stream).toEqual(expect.objectContaining({ liveId, continuationToken: 'token2' }))
    })

    test('returns null if there is no active livestream', async () => {
      await livestreamStore.initialise()

      expect(livestreamStore.activeLivestream).toBeNull()
    })
  })
}
