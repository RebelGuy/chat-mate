import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { expectObject, nameof } from '@rebel/server/_test/utils'
import LinkStore from '@rebel/server/stores/LinkStore'
import { LinkAttemptInProgressError, UserAlreadyLinkedToAggregateUserError } from '@rebel/server/util/error'
import { LinkAttempt } from '@prisma/client'
import { randomString } from '@rebel/server/util/random'

export default () => {
  let linkStore: LinkStore
  let db: Db

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    linkStore = new LinkStore(new Dependencies({
      dbProvider
    }))
    db = dbProvider.get()

  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(LinkStore, 'linkUser'), () => {
    test('Links the default user to the aggregate user', async () => {
      // users 1 and 2 are aggregate, users 3 and 4 are default
      await db.chatUser.createMany({ data: [{}, {}, {}, { aggregateChatUserId: 1 }]})

      await linkStore.linkUser(3, 1)

      await expectRowCount(db.chatUser).toBe(4)
      const storedUser3 = (await db.chatUser.findUnique({ where: { id: 3 }}))!
      expect(storedUser3.aggregateChatUserId).toBe(1)
      expect(storedUser3.linkedAt).toEqual(expect.any(Date))
    })

    test('Throws if the default user is already linked to an aggregate user', async () => {
      // users 1 and 2 are aggregate, users 3 and 4 are default
      await db.chatUser.createMany({ data: [{}, {}, {}, { aggregateChatUserId: 1 }]})

      await expect(() => linkStore.linkUser(4, 1)).rejects.toThrowError(UserAlreadyLinkedToAggregateUserError)
    })
  })

  describe(nameof(LinkStore, 'startLinkAttempt'), () => {
    test('Creates a new link attempt', async () => {
      await db.chatUser.createMany({ data: [{}, {}, {}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 1,
        defaultChatUserId: 2
      }})

      const result = await linkStore.startLinkAttempt(3, 4)

      expect(result).toBe(2)
      expect(await db.linkAttempt.findUnique({ where: { id: 2 }})).toEqual(expectObject<LinkAttempt>({ defaultChatUserId: 3, aggregateChatUserId: 4, endTime: null, startTime: expect.any(Date) }))
    })

    test('Creates a new link attempt when a previous link attempt has been completed', async () => {
      // this happens e.g. if we unlink the user, and the user re-links themselves
      await db.chatUser.createMany({ data: [{}, {}, {}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 1,
        defaultChatUserId: 2,
        endTime: new Date()
      }})

      const result = await linkStore.startLinkAttempt(1, 2)

      expect(result).toBe(2)
      expect(await db.linkAttempt.findUnique({ where: { id: 2 }})).toEqual(expectObject<LinkAttempt>({ defaultChatUserId: 1, aggregateChatUserId: 2, endTime: null, startTime: expect.any(Date) }))
    })

    test('Throws if an existing link attempt is in progress for the default user', async () => {
      await db.chatUser.createMany({ data: [{}, {}, {}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 3,
        defaultChatUserId: 1
      }})

      await expect(() => linkStore.startLinkAttempt(1, 2)).rejects.toThrowError(LinkAttemptInProgressError)
    })

    test('Throws if an existing link attempt is in progress for the aggregate user', async () => {
      await db.chatUser.createMany({ data: [{}, {}, {}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 2,
        defaultChatUserId: 3
      }})

      await expect(() => linkStore.startLinkAttempt(1, 2)).rejects.toThrowError(LinkAttemptInProgressError)
    })

    test('Throws if a previous link attempt had failed for the default user and its state not yet cleaned up by an admin', async () => {
      await db.chatUser.createMany({ data: [{}, {}, {}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 3,
        defaultChatUserId: 1,
        errorMessage: 'error'
      }})

      await expect(() => linkStore.startLinkAttempt(1, 2)).rejects.toThrowError(LinkAttemptInProgressError)
    })

    test('Throws if a previous link attempt had failed for the aggregate user and its state not yet cleaned up by an admin', async () => {
      await db.chatUser.createMany({ data: [{}, {}, {}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 2,
        defaultChatUserId: 3,
        errorMessage: 'error'
      }})

      await expect(() => linkStore.startLinkAttempt(1, 2)).rejects.toThrowError(LinkAttemptInProgressError)
    })
  })

  describe(nameof(LinkStore, 'completeLinkAttempt'), () => {
    test('Completes the successful link attempt', async () => {
      await db.chatUser.createMany({ data: [{}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 1,
        defaultChatUserId: 2
      }})

      await linkStore.completeLinkAttempt(1, null)

      const storedLinkAttempt = await db.linkAttempt.findFirst()
      expect(storedLinkAttempt).toEqual(expectObject<LinkAttempt>({ endTime: expect.any(Date), errorMessage: null }))
    })

    test('Truncates the error message if required so it can be inserted into the db', async () => {
      await db.chatUser.createMany({ data: [{}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 1,
        defaultChatUserId: 2
      }})
      const error = randomString(10000)

      await linkStore.completeLinkAttempt(1, error)

      const storedLinkAttempt = await db.linkAttempt.findFirst()
      expect(storedLinkAttempt).toEqual(expectObject<LinkAttempt>({ endTime: expect.any(Date), errorMessage: expect.any(String) }))
      expect(error.startsWith(storedLinkAttempt!.errorMessage!)).toBeTruthy()
    })
  })
}
