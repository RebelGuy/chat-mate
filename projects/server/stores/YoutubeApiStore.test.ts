import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { Db } from '@rebel/server/providers/DbProvider'
import YoutubeApiStore from '@rebel/server/stores/YoutubeApiStore'
import { Dependencies } from '@rebel/shared/context/context'
import { nameof } from '@rebel/shared/testUtils'

export default () => {
  const streamer1 = 1

  let youtubeApiStore: YoutubeApiStore
  let db: Db

  beforeEach(async () => {
    const dbProvider = await startTestDb()

    youtubeApiStore = new YoutubeApiStore(new Dependencies({
      dbProvider
    }))
    db = dbProvider.get()

    await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}})
  }, DB_TEST_TIMEOUT)

  afterEach(() => {
    stopTestDb()
  })

  describe(nameof(YoutubeApiStore, 'addApiRequest'), () => {
    test('Adds the request', async () => {
      await youtubeApiStore.addApiRequest(streamer1, 'test', 1, true)

      await expectRowCount(db.youtubeApiRequest).toEqual(1)
    })
  })
}
