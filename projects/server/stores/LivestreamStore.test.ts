import { Dependencies } from '@rebel/server/context/context'
import { IMasterchat } from '@rebel/server/interfaces'
import { Db } from '@rebel/server/providers/DbProvider'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { nameof } from '@rebel/server/_test/utils'
import { mock, mockDeep, MockProxy } from 'jest-mock-extended'

export default () => {
  const liveId = 'id1'
  let livestreamStore: LivestreamStore
  let db: Db
  let mockMasterchat: MockProxy<IMasterchat>
  let mockLogService: MockProxy<LogService>

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    mockMasterchat = mock<IMasterchat>()
    mockLogService = mock<LogService>()

    const mockMasterchatProvider = mockDeep<MasterchatProvider>({
      get: () => mockMasterchat
    })

    livestreamStore = new LivestreamStore(new Dependencies({
      dbProvider,
      liveId,
      masterchatProvider: mockMasterchatProvider,
      logService: mockLogService }))
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

  describe(nameof(LivestreamStore, 'update'), () => {
    test('continuation token is updated', async () => {
      await db.livestream.create({ data: { liveId } })
      await livestreamStore.createLivestream()

      const stream = await livestreamStore.update('token')

      expect(stream.continuationToken).toBe('token')
      expect((await db.livestream.findFirst())?.continuationToken).toBe('token')
    })

    test('throws if livestream not yet created', async () => {
      await expect(livestreamStore.update('test')).rejects.toThrow()
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

      await livestreamStore.update('token2')
      const stream = livestreamStore.currentLivestream

      expect(stream).toEqual(expect.objectContaining({ liveId, continuationToken: 'token2' }))
    })

    test('throws if livestream not yet created', () => {
      expect(() => livestreamStore.currentLivestream).toThrow()
    })
  })
}