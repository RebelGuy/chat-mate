import { RegisteredUser } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import AccountStore from '@rebel/server/stores/AccountStore'
import { sortBy } from '@rebel/shared/util/arrays'
import { UsernameAlreadyExistsError } from '@rebel/shared/util/error'
import { hashString } from '@rebel/shared/util/strings'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { expectObject, nameof } from '@rebel/shared/testUtils'

export default () => {
  let db: Db
  let accountStore: AccountStore

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    accountStore = new AccountStore(new Dependencies({ dbProvider }))
    db = dbProvider.get()
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(AccountStore, 'addRegisteredUser'), () => {
    test('Adds the registered user', async () => {
      const username = 'username'

      await accountStore.addRegisteredUser({ username: username, password: 'test' })

      await expectRowCount(db.registeredUser).toBe(1)
      await expectRowCount(db.chatUser).toBe(1)
      const storedRegisteredUser = await db.registeredUser.findFirst()
      expect(storedRegisteredUser!.username).toBe(username)
      const storedAggregateUser = await db.chatUser.findFirst()
      expect(storedRegisteredUser!.aggregateChatUserId).toBe(storedAggregateUser!.id)
    })

    test('Throws if username already exists', async () => {
      const username = 'username'
      await db.registeredUser.create({ data: { username: username, hashedPassword: 'test', aggregateChatUser: { create: {}} }})

      await expect(() => accountStore.addRegisteredUser({ username: username, password: 'test' })).rejects.toThrowError(UsernameAlreadyExistsError)
    })
  })

  describe(nameof(AccountStore, 'getRegisteredUsers'), () => {
    test('Returns the registered user or null for each of the provided users', async () => {
      await db.chatUser.create({ data: { // 1: aggregate chat user
        registeredUser: { create: { username: 'name1', hashedPassword: 'test' }}
      }})
      await db.chatUser.create({ data: { // 2: aggregate chat user
        registeredUser: { create: { username: 'name2', hashedPassword: 'test' }}
      }})
      await db.chatUser.createMany({ data: [
        {}, // 3
        { aggregateChatUserId: 1 }, // 4
        { aggregateChatUserId: 1 }, // 5
        {}, // 6
        { aggregateChatUserId: 2 }, // 7
      ]})

      const result = await accountStore.getRegisteredUsers([1, 2, 3, 4, 5, 6, 7])

      expect(result).toEqual(expectObject(result, [
        { queriedUserId: 1, primaryUserId: 1, registeredUser: expectObject<RegisteredUser>({ id: 1 }) },
        { queriedUserId: 2, primaryUserId: 2, registeredUser: expectObject<RegisteredUser>({ id: 2 }) },
        { queriedUserId: 3, primaryUserId: 3, registeredUser: null },
        { queriedUserId: 4, primaryUserId: 1, registeredUser: expectObject<RegisteredUser>({ id: 1 }) },
        { queriedUserId: 5, primaryUserId: 1, registeredUser: expectObject<RegisteredUser>({ id: 1 }) },
        { queriedUserId: 6, primaryUserId: 6, registeredUser: null },
        { queriedUserId: 7, primaryUserId: 2, registeredUser: expectObject<RegisteredUser>({ id: 2 }) },
      ]))
    })
  })

  describe(nameof(AccountStore, 'getRegisteredUserCount'), () => {
    test('Returns the number of registered accounts', async () => {
      await db.chatUser.createMany({ data: [{}, {}]})
      await db.registeredUser.createMany({ data: [
        { username: 'user1', hashedPassword: 'pass1', aggregateChatUserId: 1 },
        { username: 'user2', hashedPassword: 'pass2', aggregateChatUserId: 2 }
      ]})

      const result = await accountStore.getRegisteredUserCount()

      expect(result).toBe(2)
    })
  })

  describe(nameof(AccountStore, 'checkPassword'), () => {
    test('Returns true if user exists and password matches', async () => {
      const username = 'username'
      const password = 'test'
      await db.registeredUser.create({ data: { username: username, hashedPassword: hashString(username + password), aggregateChatUser: { create: {}} }})

      const result = await accountStore.checkPassword(username, password)

      expect(result).toBe(true)
    })

    test('Returns false if user exists but password does not match', async () => {
      const username = 'username'
      await db.registeredUser.create({ data: { username: username, hashedPassword: 'test', aggregateChatUser: { create: {}} }})

      const result = await accountStore.checkPassword(username, 'test')

      expect(result).toBe(false)
    })

    test('Returns false if user does not exist', async () => {
      const result = await accountStore.checkPassword('test', 'test')

      expect(result).toBe(false)
    })
  })

  describe(nameof(AccountStore, 'clearLoginTokens'), () => {
    test(`Clears all of the user's login tokens`, async () => {
      await db.chatUser.createMany({ data: [{}, {}]})
      await db.registeredUser.createMany({ data: [
        { username: 'user1', hashedPassword: 'pass1', aggregateChatUserId: 1 },
        { username: 'user2', hashedPassword: 'pass2', aggregateChatUserId: 2 }
      ]})
      await db.loginToken.createMany({ data: [
        { registeredUserId: 1, token: 'a' },
        { registeredUserId: 1, token: 'b' },
        { registeredUserId: 2, token: 'c' }
      ]})

      await accountStore.clearLoginTokens(1)

      await expectRowCount(db.loginToken).toBe(1)
    })
  })

  describe(nameof(AccountStore, 'createLoginToken'), () => {
    test('Creates a new token for the given user', async () => {
      const username = 'test'
      const registeredUser = await db.registeredUser.create({ data: { username: username, hashedPassword: 'test', aggregateChatUser: { create: {}} }})

      const result = await accountStore.createLoginToken(username)

      await expectRowCount(db.loginToken).toBe(1)
      expect(result).not.toBeNull()
    })

    test('Throws if the user does not exist', async () => {
      await expect(() => accountStore.createLoginToken('test')).rejects.toThrow()
    })
  })

  describe(nameof(AccountStore, 'getConnectedChatUserIds'), () => {
    test('Unconnected default user returns only its own id', async () => {
      // user 1: aggregate user
      // user 2: aggregate user
      // user 3: aggregate user
      // user 4: default, connected to aggregate user 1
      // user 5: default, not connected
      // user 6: default, connected to aggregate user 1
      // user 7: default, connected to aggregate user 2
      await db.chatUser.createMany({ data: [{}, {}, {}]})
      await db.registeredUser.createMany({ data: [
        { username: 'user1', hashedPassword: 'pass1', aggregateChatUserId: 1 },
        { username: 'user2', hashedPassword: 'pass2', aggregateChatUserId: 2 },
        { username: 'user3', hashedPassword: 'pass3', aggregateChatUserId: 3 }
      ]})
      await db.chatUser.createMany({ data: [{ aggregateChatUserId: 1 }, {}, { aggregateChatUserId: 1 }, { aggregateChatUserId: 2 }]})

      const queryingUserIds = [5, 4, 1, 3]
      const result = await accountStore.getConnectedChatUserIds(queryingUserIds)

      expect(sortBy(result, r => queryingUserIds.indexOf(r.queriedAnyUserId))).toEqual(expectObject(result, [
        // Unconnected default user returns only its own id
        { queriedAnyUserId: 5, connectedChatUserIds: [5] },

        // Connected default user returns its own id, the aggregate user, and any other connected default users
        { queriedAnyUserId: 4, connectedChatUserIds: [1, 4, 6] },

        // Aggregate user with connections returns its own id and all connected default users
        { queriedAnyUserId: 1, connectedChatUserIds: [1, 4, 6] },

        // Aggregate user without connections returns only its own id
        { queriedAnyUserId: 3, connectedChatUserIds: [3] },
      ]))
    })
  })

  describe(nameof(AccountStore, 'getRegisteredUsersFromIds'), () => {
    test('Returns known registered users for the given ids', async () => {
      const registeredUser1 = await db.registeredUser.create({ data: { username: 'test1', hashedPassword: 'test1', aggregateChatUser: { create: {}} }})
      const registeredUser2 = await db.registeredUser.create({ data: { username: 'test2', hashedPassword: 'test2', aggregateChatUser: { create: {}} }})

      const result = await accountStore.getRegisteredUsersFromIds([registeredUser1.id, 5, registeredUser2.id])

      expect(result).toEqual([registeredUser1, registeredUser2])
    })
  })

  describe(nameof(AccountStore, 'getRegisteredUserFromAggregateUser'), () => {
    test('Returns registered user for the given chat user id', async () => {
      const registeredUser = await db.registeredUser.create({ data: {
        username: 'test',
        hashedPassword: 'test',
        aggregateChatUser: { create: {} }
      }})

      const result = await accountStore.getRegisteredUserFromAggregateUser(registeredUser.aggregateChatUserId!)

      expect(result).toEqual(registeredUser)
    })

    test('Returns null if the given chat user is not associated with a registered user', async () => {
      const result = await accountStore.getRegisteredUserFromAggregateUser(1)

      expect(result).toBeNull()
    })
  })

  describe(nameof(AccountStore, 'getRegisteredUserFromToken'), () => {
    test('Returns registered user for the given token', async () => {
      const token = 'token'
      const registeredUser = await db.registeredUser.create({ data: { username: 'test', hashedPassword: 'test', aggregateChatUser: { create: {}} }})
      await db.loginToken.create({ data: { token, registeredUserId: registeredUser.id }})

      const result = await accountStore.getRegisteredUserFromToken(token)

      expect(result!.username).toBe(registeredUser.username)
    })

    test('Returns null if no registered user exists for the given token', async () => {
      const result = await accountStore.getRegisteredUserFromToken('test')

      expect(result).toBeNull()
    })
  })
}
