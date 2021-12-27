import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { nameof } from '@rebel/server/_test/utils'

export default () => {
  const liveId = 'id1'
  let livestreamStore: LivestreamStore
  let db: Db
  beforeEach(async () => {
    const dbProvider = await startTestDb()
    livestreamStore = new LivestreamStore(new Dependencies({ dbProvider, liveId }))
    db = dbProvider.get()
  })

  afterEach(stopTestDb)

  describe(nameof(LivestreamStore, 'createLivestream'), () => {
    test('new livestream added to database', async () => {
      const stream = await livestreamStore.createLivestream()

      expect(stream.liveId).toBe(liveId)
    })

    test('existing livestream returned', async () => {
      await db.livestream.create({ data: { liveId } })

      const stream = await livestreamStore.createLivestream()

      expect(stream.liveId).toBe(liveId)
      await expectRowCount(db.livestream).toBe(1)
    })
  })

  describe(nameof(LivestreamStore, 'setContinuationToken'), () => {
    test('continuation token is updated', async () => {
      await db.livestream.create({ data: { liveId } })
      await livestreamStore.createLivestream()

      const stream = await livestreamStore.setContinuationToken('token')

      expect(stream.continuationToken).toBe('token')
      expect((await db.livestream.findFirst())?.continuationToken).toBe('token')
    })

    test('throws if livestream not yet created', async () => {
      await expect(livestreamStore.setContinuationToken('test')).rejects.toThrow()
    })
  })

  describe(nameof(LivestreamStore, 'currentLivestream'), () => {
    test('returns created livestream', async () => {
      await db.livestream.create({ data: { liveId, continuationToken: 'token1' } })
      await livestreamStore.createLivestream()

      const stream = livestreamStore.currentLivestream

      expect(stream).toEqual(expect.objectContaining({ liveId, continuationToken: 'token1' }))
    })

    test('returns updated livestream', async () => {
      await db.livestream.create({ data: { liveId, continuationToken: 'token1' } })
      await livestreamStore.createLivestream()

      await livestreamStore.setContinuationToken('token2')
      const stream = livestreamStore.currentLivestream

      expect(stream).toEqual(expect.objectContaining({ liveId, continuationToken: 'token2' }))
    })

    test('throws if livestream not yet created', () => {
      expect(() => livestreamStore.currentLivestream).toThrow()
    })
  })
}