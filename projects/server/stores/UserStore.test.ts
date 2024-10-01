import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import { DB_TEST_TIMEOUT, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import UserStore from '@rebel/server/stores/UserStore'
import { nameof } from '@rebel/shared/testUtils'

export default () => {
  let db: Db
  let userStore: UserStore

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    userStore = new UserStore(new Dependencies({ dbProvider }))
    db = dbProvider.get()
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(UserStore, 'setDisplayName'), () => {
    test('Updates the display name of the specified user', async () => {
      await db.registeredUser.create({ data: { username: 'user1', displayName: 'USER1', hashedPassword: 'pass1', aggregateChatUser: { create: {}}} })
      await db.registeredUser.create({ data: { username: 'user2', displayName: null, hashedPassword: 'pass2', aggregateChatUser: { create: {}}} })

      await userStore.setDisplayName(1, null)
      await userStore.setDisplayName(2, 'USER2')

      const savedUsers = await db.registeredUser.findMany()
      expect(savedUsers.map(u => u.displayName)).toEqual([null, 'USER2'])
    })
  })
}
