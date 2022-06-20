import { TwitchFollower } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import AuthStore from '@rebel/server/stores/AuthStore'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { nameof, single } from '@rebel/server/_test/utils'
import { mock } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { addTime } from '@rebel/server/util/datetime'

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

  describe(nameof(FollowerStore, 'getFollowersSince'), () => {
    test('returns empty array if no followers since given time', async () => {
      await addFollower('1', 'a', 'A', data.time1)

      const result = await followerStore.getFollowersSince(data.time2.getTime())

      expect(result.length).toBe(0)
    })

    test('returns correct followers since given time', async () => {
      await addFollower('1', 'a', 'A', data.time1)
      await addFollower('2', 'b', 'B', data.time3)
      await addFollower('3', 'c', 'C', data.time3)

      const result = await followerStore.getFollowersSince(data.time2.getTime())

      expect(result.length).toBe(2)
      expect(result.map(r => r.twitchId)).toEqual(['2', '3'])
    })
  })

  describe(nameof(FollowerStore, 'saveNewFollower'), () => {
    test('saves new follower to the db', async () => {
      const minDate = new Date().getTime()

      await followerStore.saveNewFollower('12345', 'testuser', 'TestUser')

      // add a second because db time could be slightly different apparently
      const maxDate = addTime(new Date(), 'seconds', 1).getTime()
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
      await addFollower('12345', 'testuser', 'TestUser')

      await followerStore.saveNewFollower('12345', 'ichangedmyname', 'IChangedMyName')

      expectRowCount(db.twitchFollower).toBe(1)
    })
  })

  async function addFollower (id: string, userName: string, displayName: string, time?: Date) {
    await db.twitchFollower.create({ data: {
      twitchId: id,
      userName: userName,
      displayName: displayName,
      date: time
    }})
  }
}
