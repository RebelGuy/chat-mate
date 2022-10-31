import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import AccountStore from '@rebel/server/stores/AccountStore'
import { UsernameAlreadyExistsError } from '@rebel/server/util/error'
import { hashString } from '@rebel/server/util/strings'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { nameof } from '@rebel/server/_test/utils'

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
      const storedUser = await db.registeredUser.findFirst()
      expect(storedUser!.username).toBe(username)
    })

    test('Throws if username already exists', async () => {
      const username = 'username'
      await db.registeredUser.create({ data: { username: username, hashedPassword: 'test' }})

      await expect(() => accountStore.addRegisteredUser({ username: username, password: 'test' })).rejects.toThrowError(UsernameAlreadyExistsError)
    })
  })

  describe(nameof(AccountStore, 'checkPassword'), () => {
    test('Returns true if user exists and password matches', async () => {
      const username = 'username'
      const password = 'test'
      await db.registeredUser.create({ data: { username: username, hashedPassword: hashString(password) }})

      const result = await accountStore.checkPassword(username, password)

      expect(result).toBe(true)
    })

    test('Returns false if user exists but password does not match', async () => {
      const username = 'username'
      await db.registeredUser.create({ data: { username: username, hashedPassword: 'test' }})

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
      await db.registeredUser.createMany({ data: [
        { username: 'user1', hashedPassword: 'pass1' },
        { username: 'user2', hashedPassword: 'pass2' }
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
      const registeredUser = await db.registeredUser.create({ data: { username: username, hashedPassword: 'test' }})

      const result = await accountStore.createLoginToken(username)

      await expectRowCount(db.loginToken).toBe(1)
      expect(result).not.toBeNull()
    })

    test('Throws if the user does not exist', async () => {
      await expect(() => accountStore.createLoginToken('test')).rejects.toThrow()
    })
  })

  describe(nameof(AccountStore, 'getRegisteredUserFromToken'), () => {
    test('Returns registered user for the given token', async () => {
      const token = 'token'
      const registeredUser = await db.registeredUser.create({ data: { username: 'test', hashedPassword: 'test' }})
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
