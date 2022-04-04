import { TwitchFollower } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import AuthStore from '@rebel/server/stores/AuthStore'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { nameof, single } from '@rebel/server/_test/utils'
import { AccessToken } from '@twurple/auth'
import { mock } from 'jest-mock-extended'

export default () => {
  let followerStore: FollowerStore
  let db: Db

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    followerStore = new FollowerStore(new Dependencies({
      dbProvider,
      logService: mock()
    }))
    db = dbProvider.get()
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(FollowerStore, 'saveNewFollower'), () => {
    test('saves new follower to the db', async () => {
      const minDate = new Date().getTime()

      await followerStore.saveNewFollower('12345', 'testuser', 'TestUser')

      const maxDate = new Date().getTime()
      const expected: Partial<TwitchFollower> = {
        twitchId: '12345',
        userName: 'testuser',
        'displayName': 'TestUser',
      }
      const stored = single(await db.twitchFollower.findMany())
      expect(stored).toEqual(expect.objectContaining(expected))
      expect(stored.date.getTime()).toBeGreaterThan(minDate)
      expect(stored.date.getTime()).toBeLessThan(maxDate)
    })

    test('ignores known follower', async () => {
      await db.twitchFollower.create({ data: {
        twitchId: '12345',
        displayName: 'TestUser',
        userName: 'testuser'
      }})

      await followerStore.saveNewFollower('12345', 'ichangedmyname', 'IChangedMyName')

      expectRowCount(db.twitchFollower).toBe(1)
    })
  })
}
