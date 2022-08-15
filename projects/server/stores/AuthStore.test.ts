import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import AuthStore from '@rebel/server/stores/AuthStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { nameof } from '@rebel/server/_test/utils'
import { AccessToken } from '@twurple/auth'

const clientId = 'clientId'
const accessToken: AccessToken = {
  accessToken: 'accessToken1',
  expiresIn: 100,
  obtainmentTimestamp: 1000,
  refreshToken: 'refreshToken1',
  scope: ['scope1', 'scope2']
}
const otherAccessToken: AccessToken = {
  accessToken: 'accessToken2',
  expiresIn: 10000,
  obtainmentTimestamp: 100000,
  refreshToken: 'refreshToken2',
  scope: ['scope3', 'scope4']
}

export default () => {
  let authStore: AuthStore
  let db: Db

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    authStore = new AuthStore(new Dependencies({ dbProvider, twitchClientId: clientId }))
    db = dbProvider.get()
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(AuthStore, 'loadAccessToken'), () => {
    test('Throws if no access token exists for client', async () => {
      await addAccessToken(db, 'client2', otherAccessToken)

      await expect(() => authStore.loadAccessToken()).rejects.toThrow()
    })

    test('returns correct access token for client', async () => {
      await addAccessToken(db, 'client2', otherAccessToken)
      await addAccessToken(db, clientId, accessToken)

      const result = await authStore.loadAccessToken()

      expect(result).toEqual(accessToken)
    })
  })

  describe(nameof(AuthStore, 'saveAccessToken'), () => {
    test('adds new access token to database', async () => {
      await authStore.saveAccessToken(accessToken)

      expectRowCount(db.twitchAuth).toBe(1)
    })

    test('overwrites existing access token', async () => {
      await addAccessToken(db, clientId, accessToken)

      await authStore.saveAccessToken(otherAccessToken)

      expectRowCount(db.twitchAuth).toBe(1)
      const saved = await db.twitchAuth.findFirst()
      expect(saved).toEqual(otherAccessToken)
    })
  })
}

async function addAccessToken (db: Db, client: string, token: AccessToken) {
  await db.twitchAuth.create({ data: {
    accessToken: token.accessToken,
    clientId: client,
    expiresIn: token.expiresIn!,
    obtainmentTimestamp: token.obtainmentTimestamp,
    refreshToken: token.refreshToken!,
    scope: token.scope.join(',')
  }})
}
