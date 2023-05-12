import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { expectObject, nameof } from '@rebel/server/_test/utils'
import LinkStore from '@rebel/server/stores/LinkStore'
import { LinkAttemptInProgressError, UserAlreadyLinkedToAggregateUserError, UserNotLinkedError } from '@rebel/shared/util/error'
import { LinkAttempt, ChatUser, LinkToken } from '@prisma/client'
import { randomString } from '@rebel/shared/util/random'
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

  describe(nameof(LinkStore, 'addLinkAttemptToLinkToken'), () => {
    test('Links the token to the LinkAttempt', async () => {
      const linkToken = 'test token'
      await db.chatUser.createMany({ data: [{}, {}]})
      await db.linkAttempt.create({ data: { startTime: new Date(), log: '', type: 'link', defaultChatUserId: 1, aggregateChatUserId: 2 }})
      await db.linkToken.create({ data: { token: linkToken, defaultChatUserId: 1, aggregateChatUserId: 2 }})

      await linkStore.addLinkAttemptToLinkToken(linkToken, 1)

      const stored = await db.linkAttempt.findUnique({ where: { id: 1 }, rejectOnNotFound: true })
      expect(stored.linkTokenId).toBe(1)
    })
  })

  describe(nameof(LinkStore, 'validateLinkToken'), () => {
    test('Returns null if the link token could not be found for the default user', async () => {
      const linkToken = 'test token'
      await db.chatUser.createMany({ data: [{}, {}, {}]})
      await db.linkToken.create({ data: { token: linkToken, defaultChatUserId: 3, aggregateChatUserId: 2 }})

      const result = await linkStore.validateLinkToken(1, linkToken)

      expect(result).toBeNull()
    })

    test('Returns null if the link token was already used for a previous link attempt', async () => {
      const linkToken = 'test token'
      await db.chatUser.createMany({ data: [{}, {}]})
      await db.linkToken.create({ data: { token: linkToken, defaultChatUserId: 1, aggregateChatUserId: 2 }})
      await db.linkAttempt.create({ data: { startTime: new Date(), log: '', type: 'link', defaultChatUserId: 1, aggregateChatUserId: 2, linkTokenId: 1 }})

      const result = await linkStore.validateLinkToken(1, linkToken)

      expect(result).toBeNull()
    })

    test('Returns the link token object', async () => {
      const linkToken = 'test token'
      await db.chatUser.createMany({ data: [{}, {}]})
      await db.linkToken.create({ data: { token: linkToken, defaultChatUserId: 1, aggregateChatUserId: 2 }})

      const result = await linkStore.validateLinkToken(1, linkToken)

      expect(result).toEqual(expectObject<LinkToken>({ id: 1, token: linkToken, defaultChatUserId: 1, aggregateChatUserId: 2 }))
    })
  })

  describe(nameof(LinkStore, 'deleteLinkToken'), () => {
    test('Returns true if the link token was found for the specified user and not already used up', async () => {
      const linkToken = 'test token'
      await db.chatUser.createMany({ data: [{}, {}, {}, {}, {}]})
      await db.linkToken.createMany({ data: [
        { token: linkToken, aggregateChatUserId: 1, defaultChatUserId: 2 }, // our user, our token
        { token: 'other token 1', aggregateChatUserId: 1, defaultChatUserId: 3 }, // our user, different token
        { token: 'other token 2', aggregateChatUserId: 4, defaultChatUserId: 5 } // different user, different token
      ]})
      await db.linkAttempt.create({ data: { aggregateChatUserId: 1, defaultChatUserId: 3, linkTokenId: 2, log: '', startTime: new Date(), type: 'link' }})

      const result = await linkStore.deleteLinkToken(1, linkToken)

      expect(result).toBe(true)
    })

    test('Returns false if the link token was found for the specified user but already used up', async () => {
      const linkToken = 'test token'
      await db.chatUser.createMany({ data: [{}, {}, {}, {}, {}]})
      await db.linkToken.createMany({ data: [
        { token: 'other token 1', aggregateChatUserId: 1, defaultChatUserId: 2 }, // our user, different token
        { token: linkToken, aggregateChatUserId: 1, defaultChatUserId: 3 }, // our user, our token (used)
        { token: 'other token 2', aggregateChatUserId: 4, defaultChatUserId: 5 } // different user, different token
      ]})
      await db.linkAttempt.create({ data: { aggregateChatUserId: 1, defaultChatUserId: 3, linkTokenId: 2, log: '', startTime: new Date(), type: 'link' }})

      const result = await linkStore.deleteLinkToken(1, linkToken)

      expect(result).toBe(false)
    })

    test('Returns false if the link token was not found for the specified user', async () => {
      const linkToken = 'test token'
      await db.chatUser.createMany({ data: [{}, {}, {}, {}, {}]})
      await db.linkToken.createMany({ data: [
        { token: 'other token', aggregateChatUserId: 1, defaultChatUserId: 2 }, // our user, different token
        { token: linkToken, aggregateChatUserId: 4, defaultChatUserId: 5 } // different user, our token
      ]})

      const result = await linkStore.deleteLinkToken(1, linkToken)

      expect(result).toBe(false)
    })
  })

  describe(nameof(LinkStore, 'getOrCreateLinkToken'), () => {
    test('Creates a new token if no existing token exists for the aggregate-default user pair', async () => {
      await db.chatUser.createMany({ data: [{}, {}]})

      const result = await linkStore.getOrCreateLinkToken(1, 2)

      expect(result.token).toEqual(expect.any(String))
    })

    test('Creates a new token if an existing token exists for the aggregate-default user pair, but it was part of a completed link attempt', async () => {
      const existingToken = 'existing token'
      await db.chatUser.createMany({ data: [{}, {}]})
      await db.linkToken.create({ data: { token: existingToken, defaultChatUserId: 2, aggregateChatUserId: 1 }})
      await db.linkAttempt.create({ data: { startTime: new Date(), endTime: new Date(), log: '', type: 'link', defaultChatUserId: 1, aggregateChatUserId: 2, linkTokenId: 1 }})

      const result = await linkStore.getOrCreateLinkToken(1, 2)

      expect(result.token).not.toEqual(existingToken)
    })

    test(`Returns the existing token for the aggregate-default user pair if it hasn't been matched to a link attempt`, async () => {
      const existingToken = 'existing token'
      await db.chatUser.createMany({ data: [{}, {}]})
      await db.linkToken.create({ data: { token: existingToken, defaultChatUserId: 2, aggregateChatUserId: 1 }})

      const result = await linkStore.getOrCreateLinkToken(1, 2)

      expect(result.token).toEqual(existingToken)
    })
  })

  describe(nameof(LinkStore, 'getAllLinkTokens'), () => {
    test('Returns all link tokens for the aggregate user', async () => {
      await db.chatUser.createMany({ data: [{}, {}, {}, {}, {}]})
      await db.linkToken.createMany({ data: [
        { token: 'test1', aggregateChatUserId: 1, defaultChatUserId: 2 },
        { token: 'test2', aggregateChatUserId: 1, defaultChatUserId: 3 },
        { token: 'test3', aggregateChatUserId: 4, defaultChatUserId: 5 }
      ]})

      const result = await linkStore.getAllLinkTokens(1)

      expect(result.map(t => t.token)).toEqual(['test1', 'test2'])
    })
  })

  describe(nameof(LinkStore, 'getAllStandaloneLinkAttempts'), () => {
    test('Returns link attempts that are not attached to a link token', async () =>{
      await db.chatUser.createMany({ data: [{}, {}, {}, {}, {}]})
      await db.linkToken.createMany({ data: [
        { token: 'test1', aggregateChatUserId: 1, defaultChatUserId: 2 },
      ]})
      await db.linkAttempt.createMany({ data: [
        { aggregateChatUserId: 1, defaultChatUserId: 2, linkTokenId: 1, log: '', startTime: new Date(), type: 'link' },
        { aggregateChatUserId: 1, defaultChatUserId: 3, linkTokenId: null, log: '', startTime: new Date(), type: 'link' },
        { aggregateChatUserId: 4, defaultChatUserId: 3, linkTokenId: null, log: '', startTime: new Date(), type: 'link' }
      ]})

      const result = await linkStore.getAllStandaloneLinkAttempts(1)

      expect(result.map(attempt => attempt.id)).toEqual([2])
    })
  })

  describe(nameof(LinkStore, 'isLinkInProgress'), () => {
    test('Returns true if the aggregate user is involved in an active link attempt', async () => {
      await db.chatUser.createMany({ data: [{}, {}]})
      await db.linkAttempt.create({ data: {
        aggregateChatUserId: 1,
        defaultChatUserId: 2,
        startTime: new Date(),
        endTime: null,
        log: '',
        type: 'link'
      }})

      const result = await linkStore.isLinkInProgress(1)

      expect(result).toBe(true)
    })

    test('Returns true if the default user is involved in an active link attempt', async () => {
      await db.chatUser.createMany({ data: [{}, {}]})
      await db.linkAttempt.create({ data: {
        aggregateChatUserId: 1,
        defaultChatUserId: 2,
        startTime: new Date(),
        endTime: null,
        log: '',
        type: 'link'
      }})

      const result = await linkStore.isLinkInProgress(2)

      expect(result).toBe(true)
    })

    test('Returns false if the user is not involved in an active link attempt', async () => {
      await db.chatUser.createMany({ data: [{}, {}, {}]})
      await db.linkAttempt.create({ data: {
        aggregateChatUserId: 1,
        defaultChatUserId: 2,
        startTime: new Date(),
        endTime: new Date(), // finished
        log: '',
        type: 'link'
      }})
      await db.linkAttempt.create({ data: {
        aggregateChatUserId: 3,
        defaultChatUserId: 2,
        startTime: new Date(),
        endTime: null, // in progress
        log: '',
        type: 'link'
      }})

      const result = await linkStore.isLinkInProgress(1)

      expect(result).toBe(false)
    })
  })

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
        type: 'link',
        released: false
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
        type: 'link',
        released: false
      }})

      await expect(() => linkStore.startLinkAttempt(1, 2)).rejects.toThrowError(LinkAttemptInProgressError)
    })

    test('Does not throw if a previous link attempt had failed but its state has been cleaned up', async () => {
      await db.chatUser.createMany({ data: [{}, {}, {}, {}] })
      await db.linkAttempt.create({ data: {
        startTime: new Date(),
        endTime: new Date(),
        aggregateChatUserId: 2,
        defaultChatUserId: 3,
        log: '',
        errorMessage: 'error',
        type: 'link',
        released: true
      }})

      await linkStore.startLinkAttempt(1, 2)

      // does not throw
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

    test(`Throws ${UserNotLinkedError.name} if the user is not linkd`, async () => {
      await db.chatUser.createMany({ data: [{}, {}, { aggregateChatUserId: 1 }] })

      await expect(() => linkStore.unlinkUser(2)).rejects.toThrowError(UserNotLinkedError)
    })
  })
}
