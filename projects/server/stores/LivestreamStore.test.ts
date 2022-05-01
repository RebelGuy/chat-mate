import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { nameof } from '@rebel/server/_test/utils'
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

  describe(nameof(LivestreamStore, 'setActiveLivestream'), () => {
    test('creates and sets new active livestream', async () => {
      throw new Error('nyi')
    })

    test('updates existing livestream', async () => {
      throw new Error('nyi')
    })

    test('deactivates current active livestream', async () => {
      throw new Error('nyi')
    })
  })

  describe(nameof(LivestreamStore, 'setContinuationToken'), () => {
    test('continuation token is updated', async () => {
      await db.livestream.create({ data: { liveId, isActive: true, type: 'publicLivestream' } })
      await livestreamStore.initialise()

      const stream = await livestreamStore.setContinuationToken(liveId, 'token')

      expect(stream.continuationToken).toBe('token')
      expect((await db.livestream.findFirst())!.continuationToken).toBe('token')
    })

    test('throws if invalid id', async () => {
      await expect(livestreamStore.setContinuationToken('id', 'test')).rejects.toThrow()
    })
  })

  describe(nameof(LivestreamStore, 'setTimes'), () => {
    test('times are updated correctly', async () => {
      const time = new Date()
      await db.livestream.create({ data: { liveId, isActive: true, type: 'publicLivestream' } })
      await livestreamStore.initialise()

      const returnedStream = await livestreamStore.setTimes(liveId, { start: time, end: null })

      expect(returnedStream.start).toEqual(time)
      expect(returnedStream.end).toBeNull()

      const savedStream = (await db.livestream.findFirst())!
      expect(savedStream.start).toEqual(time)
      expect(savedStream.end).toBeNull()
    })

    test('throws if livestream not yet created', async () => {
      await expect(livestreamStore.setTimes(liveId, { start: null, end: null })).rejects.toThrow()
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

    test('throws if livestream not yet created', () => {
      expect(() => livestreamStore.activeLivestream).toThrow()
    })
  })
}
