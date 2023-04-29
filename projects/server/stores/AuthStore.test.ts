import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import AuthStore from '@rebel/server/stores/AuthStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { expectObject, nameof } from '@rebel/server/_test/utils'
import { AccessToken } from '@twurple/auth'
import { single } from '@rebel/shared/util/arrays'

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
const twitchUserId1 = 'userId1'
const twitchUserId2 = 'userId2'
const twitchChannelName1 = 'channelName1'
const twitchChannelName2 = 'channelName2'

export default () => {
  let authStore: AuthStore
  let db: Db

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    authStore = new AuthStore(new Dependencies({ dbProvider }))
    db = dbProvider.get()
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(AuthStore, 'loadTwitchAccessToken'), () => {
    test(`Returns the user token`, async () => {
      await addTwitchAccessToken(db, twitchUserId1, twitchChannelName1, accessToken)
      await addTwitchAccessToken(db, twitchUserId2, twitchChannelName2, accessToken)

      const result = await authStore.loadTwitchAccessToken(twitchUserId1)

      expect(result).toEqual(accessToken)
    })

    test(`Throws if the user's token could not be found`, async () => {
      await addTwitchAccessToken(db, twitchUserId1, twitchChannelName1, accessToken)

      await expect(() => authStore.loadTwitchAccessToken(twitchUserId2)).rejects.toThrow()
    })
  })

  describe(nameof(AuthStore, 'loadTwitchAccessTokenByChannelName'), () => {
    test(`Returns the user token`, async () => {
      await addTwitchAccessToken(db, twitchUserId1, twitchChannelName1, accessToken)
      await addTwitchAccessToken(db, twitchUserId2, twitchChannelName2, accessToken)

      const result = await authStore.loadTwitchAccessTokenByChannelName(twitchChannelName1)

      expect(result).toEqual(accessToken)
    })

    test(`Throws if the user's token could not be found`, async () => {
      await addTwitchAccessToken(db, twitchUserId1, twitchChannelName1, accessToken)

      await expect(() => authStore.loadTwitchAccessToken(twitchChannelName2)).rejects.toThrow()
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
    test('Adds the new admin access token to database', async () => {
      await authStore.saveTwitchAccessToken(twitchUserId1, twitchChannelName1, accessToken)

      await expectRowCount(db.twitchAuth).toBe(1)
    })

    test('Overwrites existing access token', async () => {
      await addTwitchAccessToken(db, twitchUserId1, twitchChannelName1, accessToken)

      await authStore.saveTwitchAccessToken(twitchUserId1, twitchChannelName1, otherAccessToken)

      const saved = await db.twitchAuth.findMany().then(single)
      expect(saved).toEqual(expectObject(saved, {
        refreshToken: otherAccessToken.refreshToken!,
        expiresIn: otherAccessToken.expiresIn!,
        obtainmentTimestamp: BigInt(otherAccessToken.obtainmentTimestamp!),
        scope: otherAccessToken.scope.join(',')
      }))
    })

    test('Throws if attempting to update an access token without providing the Twitch userId', async () => {
      await addTwitchAccessToken(db, null, twitchChannelName1, accessToken)

      await expect(() => authStore.saveTwitchAccessToken(null, twitchChannelName1, otherAccessToken)).rejects.toThrow()
    })

    test('Throws if attempting to create a new token without providing a Twitch channel name', async () => {
      await expect(() => authStore.saveTwitchAccessToken(twitchUserId1, null, otherAccessToken)).rejects.toThrow()
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

  describe(nameof(AuthStore, 'tryDeleteTwitchAccessToken'), () => {
    test('Deletes the access token for the specified Twitch user', async () => {
      await addTwitchAccessToken(db, twitchUserId1, twitchChannelName1, accessToken)
      await addTwitchAccessToken(db, twitchUserId2, twitchChannelName2, otherAccessToken)

      await authStore.tryDeleteTwitchAccessToken(twitchUserId2)

      const stored = await db.twitchAuth.findMany().then(single)
      expect(stored.twitchUserId).toBe(twitchUserId1)
    })

    test('Does not throw if Twitch user does not exist', async () => {
      await addTwitchAccessToken(db, twitchUserId1, twitchChannelName1, accessToken)

      await authStore.tryDeleteTwitchAccessToken(twitchUserId2)

      const stored = await db.twitchAuth.findMany().then(single)
      expect(stored.twitchUserId).toBe(twitchUserId1)
    })
  })
}

async function addTwitchAccessToken (db: Db, twitchUserId: string | null, twitchChannelName: string, token: AccessToken) {
  await db.twitchAuth.create({ data: {
    accessToken: token.accessToken,
    twitchUsername: twitchChannelName,
    twitchUserId: twitchUserId,
    expiresIn: token.expiresIn!,
    obtainmentTimestamp: token.obtainmentTimestamp,
    refreshToken: token.refreshToken!,
    scope: token.scope.join(',')
  }})
}
