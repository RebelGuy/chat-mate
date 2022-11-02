import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb } from '@rebel/server/_test/db'
import { nameof } from '@rebel/server/_test/utils'

export default () => {
  let db: Db
  let streamerStore: StreamerStore

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    streamerStore = new StreamerStore(new Dependencies({ dbProvider }))
    db = dbProvider.get()
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(StreamerStore, 'getStreamerByName'), () => {
    test('Returns streamer with the given username', async () => {
      const username1 = 'username1'
      const username2 = 'username2'
      await db.registeredUser.createMany({ data: [
        { username: username1, hashedPassword: '123' },
        { username: username2, hashedPassword: '123' }
      ]})
      await db.streamer.create({ data: { registeredUserId: 2 }})

      const result = await streamerStore.getStreamerByName(username2)

      expect(result!.id).toBe(1)
    })

    test('Returns null if no streamer exists with the given username', async () => {
      const username1 = 'username1'
      const username2 = 'username2'
      await db.registeredUser.createMany({ data: [
        { username: username1, hashedPassword: '123' },
        { username: username2, hashedPassword: '123' }
      ]})
      await db.streamer.create({ data: { registeredUserId: 2 }})

      const result = await streamerStore.getStreamerByName(username1)

      expect(result).toBeNull()
    })
  })
}
