import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { Db } from '@rebel/server/providers/DbProvider'
import PlatformApiStore from '@rebel/server/stores/PlatformApiStore'
import { Dependencies } from '@rebel/shared/context/context'
import { expectObject, nameof } from '@rebel/shared/testUtils'
import * as data from '@rebel/server/_test/testData'

export default () => {
  const streamer1 = 1

  let platformApiStore: PlatformApiStore
  let db: Db

  beforeEach(async () => {
    const dbProvider = await startTestDb()

    platformApiStore = new PlatformApiStore(new Dependencies({
      dbProvider
    }))
    db = dbProvider.get()

    await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}})
  }, DB_TEST_TIMEOUT)

  afterEach(() => {
    stopTestDb()
  })

  describe(nameof(PlatformApiStore, 'addApiRequest'), () => {
    test('Adds the request', async () => {
      await platformApiStore.addApiRequest(streamer1, 'youtubeApi', new Date().getTime(), new Date().getTime(), 'test.endpoint', 'test data', 'test error')

      await expectRowCount(db.platformApiCall).toEqual(1)
    })
  })

  describe(nameof(PlatformApiStore, 'removeSuccessfulRequestsSince'), () => {
    test('Removes older requests whose endpoint equals the given string', async () => {
      const endpoint = 'endpoint'
      const otherEndpoint = 'other'
      await db.platformApiCall.createMany({ data: [
        { start: data.time1, end: data.time2, endpoint: endpoint, platform: 'test', streamerId: streamer1 }, // matches both endpoint and time
        { start: data.time3, end: data.time4, endpoint: endpoint, platform: 'test', streamerId: streamer1 }, // matches endpoint but too recent
        { start: data.time1, end: data.time2, endpoint: otherEndpoint, platform: 'test', streamerId: streamer1 } // matches time but other endpoint
      ]})

      const result = await platformApiStore.removeSuccessfulRequestsSince(data.time3.getTime(), endpoint)

      expect(result).toBe(1)
      const storedEntries = await db.platformApiCall.findMany({})
      expect(storedEntries).toEqual(expectObject(storedEntries, [{ id: 2 }, { id: 3 }]))
    })

    test('Removes requests whose endpoint matches the given wildcard string', async () => {
      const endpoint1 = 'masterchat[abc].fetch'
      const endpoint2 = 'masterchat[def].fetch'
      const endpoint3 = 'masterchat[abc].other'
      await db.platformApiCall.createMany({ data: [
        { start: data.time1, end: data.time2, endpoint: endpoint1, platform: 'test', streamerId: streamer1 },
        { start: data.time1, end: data.time2, endpoint: endpoint2, platform: 'test', streamerId: streamer1 },
        { start: data.time1, end: data.time2, endpoint: endpoint3, platform: 'test', streamerId: streamer1 }
      ]})

      const result = await platformApiStore.removeSuccessfulRequestsSince(data.time3.getTime(), 'masterchat[%].fetch')

      expect(result).toBe(2)
      const storedEntries = await db.platformApiCall.findMany({})
      expect(storedEntries).toEqual(expectObject(storedEntries, [{ id: 3 }]))
    })

    test('Does not remove failed requests', async () => {
      const endpoint = 'endpoint'
      await db.platformApiCall.createMany({ data: [
        { start: data.time1, end: data.time2, endpoint: endpoint, platform: 'test', streamerId: streamer1, error: 'error' },
      ]})

      const result = await platformApiStore.removeSuccessfulRequestsSince(data.time3.getTime(), endpoint)

      expect(result).toBe(0)
      await expectRowCount(db.platformApiCall).toBe(1)
    })
  })
}
