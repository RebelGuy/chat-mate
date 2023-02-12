import { Dependencies } from '@rebel/shared/context/context'
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

  describe(nameof(AuthStore, 'loadTwitchAccessToken'), () => {
    test('Throws if no access token exists for client', async () => {
      await addTwitchAccessToken(db, 'client2', otherAccessToken)

      await expect(() => authStore.loadTwitchAccessToken()).rejects.toThrow()
    })

    test('returns correct access token for client', async () => {
      await addTwitchAccessToken(db, 'client2', otherAccessToken)
      await addTwitchAccessToken(db, clientId, accessToken)

      const result = await authStore.loadTwitchAccessToken()

      expect(result).toEqual(accessToken)
    })
  })

  describe(nameof(AuthStore, 'loadYoutubeAccessToken'), () => {
    test('Returns access token for channelId', async () => {
      await db.youtubeAuth.createMany({ data: [
        { channelId: 'channel1', accessToken: 'token1', updateTime: new Date() },
        { channelId: 'channel2', accessToken: 'token2', updateTime: new Date() }
      ]})

      const result = await authStore.loadYoutubeAccessToken('channel1')

      expect(result).toBe('token1')
    })

    test('Returns null if no token exists for the given channelId', async () => {
      await db.youtubeAuth.create({ data: { channelId: 'channel1', accessToken: 'token1', updateTime: new Date() }})

      const result = await authStore.loadYoutubeAccessToken('channel2')

      expect(result).toBeNull()

    })
  })

  describe(nameof(AuthStore, 'saveTwitchAccessToken'), () => {
    test('adds new access token to database', async () => {
      await authStore.saveTwitchAccessToken(accessToken)

      expectRowCount(db.twitchAuth).toBe(1)
    })

    test('overwrites existing access token', async () => {
      await addTwitchAccessToken(db, clientId, accessToken)

      await authStore.saveTwitchAccessToken(otherAccessToken)

      expectRowCount(db.twitchAuth).toBe(1)
      const saved = await db.twitchAuth.findFirst()
      expect(saved).toEqual(otherAccessToken)
    })
  })

  describe(nameof(AuthStore, 'saveYoutubeAccessToken'), () => {
    test('creates new entry if no access token for channelId exists already', async () => {
      await db.youtubeAuth.create({ data: { channelId: 'channel1', accessToken: 'token1', updateTime: new Date() }})

      await authStore.saveYoutubeAccessToken('channel2', 'token2')

      await expectRowCount(db.youtubeAuth).toBe(2)
      const stored = await db.youtubeAuth.findUnique({ where: { channelId: 'channel2' }})
      expect(stored!.channelId).toBe('channel2')
      expect(stored!.accessToken).toBe('token2')
    })

    test('updates existing entry with channelId', async () => {
      const originalDate = new Date()
      await db.youtubeAuth.createMany({ data: [
        { channelId: 'channel1', accessToken: 'token1', updateTime: new Date() },
        { channelId: 'channel2', accessToken: 'token2', updateTime: originalDate }
      ]})

      await authStore.saveYoutubeAccessToken('channel2', 'token3')

      await expectRowCount(db.youtubeAuth).toBe(2)
      const stored = await db.youtubeAuth.findUnique({ where: { channelId: 'channel2' }})
      expect(stored!.channelId).toBe('channel2')
      expect(stored!.accessToken).toBe('token3')
      expect(stored!.updateTime.getTime()).not.toBe(originalDate.getTime())
    })
  })
}

async function addTwitchAccessToken (db: Db, client: string, token: AccessToken) {
  await db.twitchAuth.create({ data: {
    accessToken: token.accessToken,
    clientId: client,
    expiresIn: token.expiresIn!,
    obtainmentTimestamp: token.obtainmentTimestamp,
    refreshToken: token.refreshToken!,
    scope: token.scope.join(',')
  }})
}
