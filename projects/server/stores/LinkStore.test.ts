import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { expectObject, nameof } from '@rebel/server/_test/utils'
import LinkStore from '@rebel/server/stores/LinkStore'
import { LinkAttemptInProgressError, UserAlreadyLinkedToAggregateUserError, UserNotLinkedError } from '@rebel/server/util/error'
import { LinkAttempt, ChatUser } from '@prisma/client'
import { randomString } from '@rebel/server/util/random'
import { LinkLog } from '@rebel/server/services/LinkService'

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
        defaultChatUserId: 2,
        log: '',
        type: 'link'
      }})

      const result = await linkStore.startLinkAttempt(3, 4)

      expect(result).toBe(2)
      expect(await db.linkAttempt.findUnique({ where: { id: 2 }})).toEqual(expectObject<LinkAttempt>({ defaultChatUserId: 3, aggregateChatUserId: 4, endTime: null, startTime: expect.any(Date), type: 'link' }))
    })

    test('Creates a new link attempt when a previous link attempt has been completed', async () => {
      // this happens e.g. if we unlink the user, and the user re-links themselves
      await db.chatUser.createMany({ data: [{}, {}, {}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 1,
        defaultChatUserId: 2,
        log: '',
        endTime: new Date(),
        type: 'link'
      }})

      const result = await linkStore.startLinkAttempt(1, 2)

      expect(result).toBe(2)
      expect(await db.linkAttempt.findUnique({ where: { id: 2 }})).toEqual(expectObject<LinkAttempt>({ defaultChatUserId: 1, aggregateChatUserId: 2, endTime: null, startTime: expect.any(Date), type: 'link' }))
    })

    test('Throws if an existing link attempt is in progress for the default user', async () => {
      await db.chatUser.createMany({ data: [{}, {}, {}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 3,
        defaultChatUserId: 1,
        log: '',
        type: 'link'
      }})

      await expect(() => linkStore.startLinkAttempt(1, 2)).rejects.toThrowError(LinkAttemptInProgressError)
    })

    test('Throws if an existing link attempt is in progress for the aggregate user', async () => {
      await db.chatUser.createMany({ data: [{}, {}, {}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 2,
        defaultChatUserId: 3,
        log: '',
        type: 'link'
      }})

      await expect(() => linkStore.startLinkAttempt(1, 2)).rejects.toThrowError(LinkAttemptInProgressError)
    })

    test('Throws if a previous link attempt had failed for the default user and its state not yet cleaned up by an admin', async () => {
      await db.chatUser.createMany({ data: [{}, {}, {}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 3,
        defaultChatUserId: 1,
        log: '',
        errorMessage: 'error',
        type: 'link'
      }})

      await expect(() => linkStore.startLinkAttempt(1, 2)).rejects.toThrowError(LinkAttemptInProgressError)
    })

    test('Throws if a previous link attempt had failed for the aggregate user and its state not yet cleaned up by an admin', async () => {
      await db.chatUser.createMany({ data: [{}, {}, {}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 2,
        defaultChatUserId: 3,
        log: '',
        errorMessage: 'error',
        type: 'link'
      }})

      await expect(() => linkStore.startLinkAttempt(1, 2)).rejects.toThrowError(LinkAttemptInProgressError)
    })
  })

  describe(nameof(LinkStore, 'startUnlinkAttempt'), () => {
    test('Creates a new link attempt', async () => {
      await db.chatUser.createMany({ data: [{}, {}, { aggregateChatUserId: 1 }] })

      const result = await linkStore.startUnlinkAttempt(3)

      expect(result).toBe(1)
      expect(await db.linkAttempt.findUnique({ where: { id: 1 }})).toEqual(expectObject<LinkAttempt>({ defaultChatUserId: 3, aggregateChatUserId: 1, endTime: null, startTime: expect.any(Date), type: 'unlink' }))
    })

    test(`Throws ${UserNotLinkedError} when the user is not linked`, async () => {
      await db.chatUser.createMany({ data: [{}, {}, { aggregateChatUserId: 1 }] })

      await expect(() => linkStore.startUnlinkAttempt(2)).rejects.toThrowError(UserNotLinkedError)
    })

    // I won't bother testing anything else, as this works the same as `startLinkAttempt`
  })

  describe(nameof(LinkStore, 'completeLinkAttempt'), () => {
    test('Completes the successful link attempt', async () => {
      await db.chatUser.createMany({ data: [{}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 1,
        defaultChatUserId: 2,
        log: '',
        type: 'link'
      }})
      const log: LinkLog[] = []

      await linkStore.completeLinkAttempt(1, log, null)

      const storedLinkAttempt = await db.linkAttempt.findFirst()
      expect(storedLinkAttempt).toEqual(expectObject<LinkAttempt>({ endTime: expect.any(Date), errorMessage: null, log: '[]' }))
    })

    test('Truncates the error message if required so it can be inserted into the db', async () => {
      await db.chatUser.createMany({ data: [{}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 1,
        defaultChatUserId: 2,
        log: '',
        type: 'link'
      }})
      const error = randomString(10000)
      const log: LinkLog[] = []

      await linkStore.completeLinkAttempt(1, log, error)

      const storedLinkAttempt = await db.linkAttempt.findFirst()
      expect(storedLinkAttempt).toEqual(expectObject<LinkAttempt>({ endTime: expect.any(Date), errorMessage: expect.any(String), log: '[]' }))
      expect(error.startsWith(storedLinkAttempt!.errorMessage!)).toBeTruthy()
    })
  })

  describe(nameof(LinkStore, 'deleteLinkAttempt'), () => {
    test('Deletes the specified link attempt', async () => {
      await db.chatUser.createMany({ data: [{}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        aggregateChatUserId: 1,
        defaultChatUserId: 2,
        log: '',
        errorMessage: null,
        type: 'link'
      }})

      await linkStore.deleteLinkAttempt(1)

      await expectRowCount(db.linkAttempt).toBe(0)
    })
  })

  describe(nameof(LinkStore, 'unlinkUser'), () => {
    test('Unlinks the default user from its currently linked aggregate user', async () => {
      await db.chatUser.createMany({ data: [{}, {}, { aggregateChatUserId: 1, linkedAt: new Date() }] })

      const result = await linkStore.unlinkUser(3)

      expect(result).toBe(1)
      const storedUser = await db.chatUser.findUnique({ where: { id: 3 }, rejectOnNotFound: true })
      expect(storedUser).toEqual(expectObject<ChatUser>({ aggregateChatUserId: null, linkedAt: null }))
    })

    test(`Throws ${UserNotLinkedError} if the user is not linkd`, async () => {
      await db.chatUser.createMany({ data: [{}, {}, { aggregateChatUserId: 1 }] })

      await expect(() => linkStore.unlinkUser(2)).rejects.toThrowError(UserNotLinkedError)
    })
  })
}
