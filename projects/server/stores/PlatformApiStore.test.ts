import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { Db } from '@rebel/server/providers/DbProvider'
import PlatformApiStore from '@rebel/server/stores/PlatformApiStore'
import { Dependencies } from '@rebel/shared/context/context'
import { nameof } from '@rebel/shared/testUtils'

export default () => {
  const streamer1 = 1

  let youtubeApiStore: PlatformApiStore
  let db: Db

  beforeEach(async () => {
    const dbProvider = await startTestDb()

    youtubeApiStore = new PlatformApiStore(new Dependencies({
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
      await youtubeApiStore.addApiRequest(streamer1, 'youtubeApi', new Date().getTime(), new Date().getTime(), 'test.endpoint', 'test data', 'test error')

      await expectRowCount(db.platformApiCall).toEqual(1)
    })
  })
}
