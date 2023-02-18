import { TwitchFollower } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import AuthStore from '@rebel/server/stores/AuthStore'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/shared/util/arrays'
import { mock } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { addTime } from '@rebel/shared/util/datetime'

const streamer1 = 1
const streamer2 = 2

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

    await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}})
    await db.streamer.create({ data: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }}}})
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(FollowerStore, 'getFollowersSince'), () => {
    test('returns empty array if no followers since given time', async () => {
      await addFollower(streamer1, '1', 'a', 'A', data.time1)
      await addFollower(streamer2, '2', 'b', 'B', data.time3) // other streamer

      const result = await followerStore.getFollowersSince(streamer1, data.time2.getTime())

      expect(result.length).toBe(0)
    })

    test('returns correct followers since given time', async () => {
      await addFollower(streamer1, '1', 'a', 'A', data.time1)
      await addFollower(streamer1, '2', 'b', 'B', data.time3)
      await addFollower(streamer1, '3', 'c', 'C', data.time3)

      const result = await followerStore.getFollowersSince(streamer1, data.time2.getTime())

      expect(result.length).toBe(2)
      expect(result.map(r => r.twitchId)).toEqual(['2', '3'])
    })
  })

  describe(nameof(FollowerStore, 'saveNewFollower'), () => {
    test('saves new follower to the db', async () => {
      const minDate = new Date().getTime() - 1

      await followerStore.saveNewFollower(streamer1, '12345', 'testuser', 'TestUser')

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
      await addFollower(streamer1, '12345', 'testuser', 'TestUser')

      await followerStore.saveNewFollower(streamer1, '12345', 'ichangedmyname', 'IChangedMyName')

      expectRowCount(db.twitchFollower).toBe(1)
    })
  })

  async function addFollower (streamerId: number, id: string, userName: string, displayName: string, time?: Date) {
    await db.twitchFollower.create({ data: {
      streamerId: streamerId,
      twitchId: id,
      userName: userName,
      displayName: displayName,
      date: time
    }})
  }
}
