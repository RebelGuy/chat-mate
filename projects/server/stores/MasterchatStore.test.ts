import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import { DB_TEST_TIMEOUT, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { expectObject, nameof } from '@rebel/shared/testUtils'
import MasterchatStore from '@rebel/server/stores/MasterchatStore'
import { MasterchatAction } from '@prisma/client'
import { addTime } from '@rebel/shared/util/datetime'
import { randomString } from '@rebel/shared/util/random'

export default () => {
  const liveId1 = 'id1'
  const liveId2 = 'id2'
  const streamer1 = 1
  const streamer2 = 2

  let masterchatStore: MasterchatStore
  let db: Db

  beforeEach(async () => {
    const dbProvider = await startTestDb()

    masterchatStore = new MasterchatStore(new Dependencies({
      dbProvider
    }))
    db = dbProvider.get()

    await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}})
    await db.streamer.create({ data: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }}}})
    await db.livestream.createMany({ data: [
      { liveId: liveId1, streamerId: streamer1, isActive: true },
      { liveId: liveId2, streamerId: streamer2, isActive: true }
    ]})
  }, DB_TEST_TIMEOUT)

  afterEach(() => {
    stopTestDb()
  })

  describe(nameof(MasterchatStore, 'addMasterchatAction'), () => {
    test('Adds the action', async () => {
      const time = new Date()

      await masterchatStore.addMasterchatAction('test1', 'data1', null, liveId1)
      await masterchatStore.addMasterchatAction('test2', 'data2', time.getTime(), liveId2)

      const [stored1, stored2] = await db.masterchatAction.findMany({})
      expect(stored1).toEqual(expectObject<MasterchatAction>({ type: 'test1', data: 'data1', time: null, livestreamId: 1 }))
      expect(stored2).toEqual(expectObject<MasterchatAction>({ type: 'test2', data: 'data2', time: time, livestreamId: 2 }))
    })

    test('Truncates the data if it is too long', async () => {
      const longData = randomString(5000)

      await masterchatStore.addMasterchatAction('', longData, null, liveId1)

      const stored = await db.masterchatAction.findFirst()
      expect(stored!.data.length).toBe(4096)
    })
  })

  describe(nameof(MasterchatStore, 'hasActionWithTime'), () => {
    test('Returns false if another action exists for a different livestream', async () => {
      const time = new Date()
      await db.masterchatAction.create({ data: {
        type: 'type',
        data: '',
        livestreamId: 2,
        time: time
      }})

      const result = await masterchatStore.hasActionWithTime('type', time.getTime(), liveId1)

      expect(result).toBe(false)
    })

    test('Returns false if the action exists at a different time', async () => {
      const time = new Date()
      await db.masterchatAction.create({ data: {
        type: 'type',
        data: '',
        livestreamId: 1,
        time: addTime(time, 'seconds', -1)
      }})

      const result = await masterchatStore.hasActionWithTime('type', time.getTime(), liveId1)

      expect(result).toBe(false)
    })

    test('Returns true if the specified action exists in the db', async () => {
      const time = new Date()
      await db.masterchatAction.create({ data: {
        type: 'type',
        data: '',
        livestreamId: 1,
        time: time
      }})

      const result = await masterchatStore.hasActionWithTime('type', time.getTime(), liveId1)

      expect(result).toBe(true)
    })
  })
}
