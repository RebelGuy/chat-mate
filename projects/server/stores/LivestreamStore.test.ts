import { Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import { IMasterchat } from '@rebel/server/interfaces'
import { Db } from '@rebel/server/providers/DbProvider'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import LogService from '@rebel/server/services/LogService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { nameof } from '@rebel/server/_test/utils'
import { mock, mockDeep, MockProxy } from 'jest-mock-extended'

const metadataInProgress: Metadata = {
  channelId: 'mock channel id',
  videoId: 'mock video id',
  channelName: 'mock channel name',
  isLive: true,
  title: 'mock title'
}

export default () => {
  const liveId = 'id1'
  let livestreamStore: LivestreamStore
  let db: Db
  let mockMasterchat: MockProxy<IMasterchat>
  let mockLogService: MockProxy<LogService>

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    mockMasterchat = mock<IMasterchat>()
    mockMasterchat.fetchMetadata.mockResolvedValue(metadataInProgress)

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

    // for some reason we have to use the `legacy` option, else tests will time out.
    // it seems like jest doesn't like setInterval() very much...
    jest.useFakeTimers('legacy')
  })

  afterEach(() => {
    jest.clearAllTimers()
    stopTestDb()
  })

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

    test('not started status inferred from metadata', async () => {
      await db.livestream.create({ data: { liveId } })
      mockMasterchat.fetchMetadata.mockClear()
      mockMasterchat.fetchMetadata.mockResolvedValueOnce({ ...metadataInProgress, isLive: false })

      const stream = await livestreamStore.createLivestream()

      expect(stream.start).toBeNull()
      expect(stream.end).toBeNull()
    })

    test('in progress status inferred from metadata', async () => {
      await db.livestream.create({ data: { liveId } })
      mockMasterchat.fetchMetadata.mockClear()
      mockMasterchat.fetchMetadata.mockResolvedValueOnce({ ...metadataInProgress, isLive: true })

      const stream = await livestreamStore.createLivestream()

      expect(stream.start).not.toBeNull()
      expect(stream.end).toBeNull()
    })

    test('finished status inferred from metadata', async () => {
      await db.livestream.create({ data: { liveId, start: new Date() } })
      mockMasterchat.fetchMetadata.mockClear()
      mockMasterchat.fetchMetadata.mockResolvedValueOnce({ ...metadataInProgress, isLive: false })

      const stream = await livestreamStore.createLivestream()

      expect(stream.start).not.toBeNull()
      expect(stream.end).not.toBeNull()
    })

    test('throws if invalid inferred status', async () => {
      await db.livestream.create({ data: { liveId, start: new Date(), end: new Date() } })
      mockMasterchat.fetchMetadata.mockClear()
      mockMasterchat.fetchMetadata.mockResolvedValueOnce({ ...metadataInProgress, isLive: true })

      await expect(livestreamStore.createLivestream()).rejects.toThrow()
    })

    test('updates metadata regularly', async () => {
      await livestreamStore.createLivestream()
      expect(mockMasterchat.fetchMetadata).toBeCalledTimes(1)

      // don't use `runAllTimers`, as it will run into infinite recursion
      jest.runOnlyPendingTimers()
      expect(mockMasterchat.fetchMetadata).toBeCalledTimes(2)

      jest.runOnlyPendingTimers()
      expect(mockMasterchat.fetchMetadata).toBeCalledTimes(3)
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