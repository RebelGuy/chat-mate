import { ChatUser } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import GenericStore, { ReplacementData } from '@rebel/server/stores/GenericStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { expectObject, nameof } from '@rebel/server/_test/utils'
import * as data from '@rebel/server/_test/testData'

export default () => {
  let genericStore: GenericStore
  let db: Db

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    genericStore = new GenericStore(new Dependencies({
      dbProvider
    }))
    db = dbProvider.get()

  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(GenericStore, 'replaceMany'), () => {
    test('Throws if updating the same entry multiple times', async () => {
      const replacementData: ReplacementData<'chatUser'>[] = [{ id: 1 }, { id: 2 }, { id: 2 }]

      await expect(() => genericStore.replaceMany('chatUser', replacementData)).rejects.toThrow()
    })

    test('Throws if not all data entries have the exact same keys', async () => {
      const replacementData: ReplacementData<'chatUser'>[] = [{ id: 1, aggregateChatUserId: 1, linkedAt: new Date() }, { id: 2 }, { id: 3 }]

      await expect(() => genericStore.replaceMany('chatUser', replacementData)).rejects.toThrow()
    })

    test('Throws without modifications if replacement data included a non-existent entry', async () => {
      await db.chatUser.createMany({ data: [{}, {}]})
      const replacementData: ReplacementData<'chatUser'>[] = [{ id: 1, aggregateChatUserId: 1, linkedAt: new Date() }, { id: 3 }]

      await expect(() => genericStore.replaceMany('chatUser', replacementData)).rejects.toThrow()

      await expectRowCount(db.chatUser).toBe(2)
      expect(await db.chatUser.findFirst()).toEqual<ChatUser>({ id: 1, aggregateChatUserId: null, linkedAt: null })
    })

    test('Updates the specified entries', async () => {
      await db.chatUser.createMany({ data: [{}, { aggregateChatUserId: 1, linkedAt: data.time1 }, {}, { linkedAt: data.time4 }]})
      const replacementData: ReplacementData<'chatUser'>[] = [
        { id: 1, aggregateChatUserId: 1, linkedAt: data.time2 },
        { id: 2, aggregateChatUserId: null, linkedAt: data.time3 },
        { id: 4, aggregateChatUserId: 2, linkedAt: null }
      ]

      await genericStore.replaceMany('chatUser', replacementData)

      await expectRowCount(db.chatUser).toBe(4)
      const [user1, user2, user3, user4] = await db.chatUser.findMany()
      expect(user1).toEqual(expectObject<ChatUser>({ id: 1, aggregateChatUserId: replacementData[0].aggregateChatUserId, linkedAt: replacementData[0].linkedAt as Date }))
      expect(user2).toEqual(expectObject<ChatUser>({ id: 2, aggregateChatUserId: replacementData[1].aggregateChatUserId, linkedAt: replacementData[1].linkedAt as Date }))
      expect(user3).toEqual(expectObject<ChatUser>({ id: 3, aggregateChatUserId: null, linkedAt: null }))
      expect(user4).toEqual(expectObject<ChatUser>({ id: 4, aggregateChatUserId: replacementData[2].aggregateChatUserId, linkedAt: replacementData[2].linkedAt as Date }))
    })

    test('Updates some columns in the specified entries', async () => {
      await db.chatUser.createMany({ data: [{}, { aggregateChatUserId: 1, linkedAt: data.time1 }, {}]})
      const replacementData: ReplacementData<'chatUser'>[] = [
        { id: 1, aggregateChatUserId: 2 },
        { id: 2, aggregateChatUserId: null }
      ]

      await genericStore.replaceMany('chatUser', replacementData)

      await expectRowCount(db.chatUser).toBe(3)
      const [user1, user2, user3] = await db.chatUser.findMany()
      expect(user1).toEqual(expectObject<ChatUser>({ id: 1, aggregateChatUserId: replacementData[0].aggregateChatUserId, linkedAt: null }))
      expect(user2).toEqual(expectObject<ChatUser>({ id: 2, aggregateChatUserId: replacementData[1].aggregateChatUserId, linkedAt: data.time1 }))
      expect(user3).toEqual(expectObject<ChatUser>({ id: 3, aggregateChatUserId: null, linkedAt: null }))
    })
  })
}
