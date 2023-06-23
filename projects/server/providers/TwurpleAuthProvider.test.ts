import { Dependencies } from '@rebel/shared/context/context'
import AppTokenAuthProviderFactory from '@rebel/server/factories/AppTokenAuthProviderFactory'
import RefreshingAuthProviderFactory from '@rebel/server/factories/RefreshingAuthProviderFactory'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import AuthStore from '@rebel/server/stores/AuthStore'
import { cast, expectArray, expectObject, nameof } from '@rebel/shared/testUtils'
import { single, single2 } from '@rebel/shared/util/arrays'
import { AccessToken, AccessTokenWithUserId, AppTokenAuthProvider, RefreshingAuthProvider } from '@twurple/auth'
import { mock, MockProxy } from 'jest-mock-extended'
import { TWITCH_SCOPE } from '@rebel/server/constants'
import { AuthorisationExpiredError, InconsistentScopesError, NotAuthorisedError } from '@rebel/shared/util/error'

const adminTwitchUserId = 'admin id' as string & AccessToken

let clientId: string
let clientSecret: string
let adminTwitchUsername: string
let mockAuthStore: MockProxy<AuthStore>
let mockRefreshingAuthProvider: MockProxy<RefreshingAuthProvider>
let mockRefreshingAuthProviderFactory: MockProxy<RefreshingAuthProviderFactory>
let mockClientCredentialsAuthProvider: MockProxy<AppTokenAuthProvider>
let mockAppTokenAuthProviderFactory: MockProxy<AppTokenAuthProviderFactory>
let twurpleAuthProvider: TwurpleAuthProvider

beforeEach(() => {
  clientId = 'client id'
  clientSecret = 'client secret'
  adminTwitchUsername = 'twitch username'
  mockAuthStore = mock()
  mockRefreshingAuthProvider = mock()
  mockRefreshingAuthProviderFactory = mock()
  mockClientCredentialsAuthProvider = mock()
  mockAppTokenAuthProviderFactory = mock()

  mockRefreshingAuthProviderFactory.create.calledWith(expect.anything()).mockReturnValue(mockRefreshingAuthProvider)
  mockAppTokenAuthProviderFactory.create.calledWith(clientId, clientSecret).mockReturnValue(mockClientCredentialsAuthProvider)

  twurpleAuthProvider = new TwurpleAuthProvider(new Dependencies({
    disableExternalApis: false,
    nodeEnv: 'release',
    twitchClientId: clientId,
    twitchClientSecret: clientSecret,
    twitchUsername: adminTwitchUsername,
    logService: mock(),
    authStore: mockAuthStore,
    refreshingAuthProviderFactory: mockRefreshingAuthProviderFactory,
    appTokenAuthProviderFactory: mockAppTokenAuthProviderFactory
  }))
})

describe(nameof(TwurpleAuthProvider, 'initialise'), () => {
  const storedAdminToken = cast<AccessToken>({ accessToken: 'loaded access token', refreshToken: 'loaded refresh token', scope: TWITCH_SCOPE })

  test('Throws if access token failed to load for RefreshingAuthProvider', async () => {
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockRejectedValue(new Error('Test'))

    await expect(() => twurpleAuthProvider.initialise()).rejects.toThrow()
  })

  test('Uses loaded admion token details if access token exists for RefreshingAuthProvider', async () => {
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockResolvedValue(storedAdminToken)

    await twurpleAuthProvider.initialise()

    const args = single(mockRefreshingAuthProvider.addUserForToken.mock.calls)
    expect(args).toEqual(expectArray(args, [storedAdminToken, ['chat']]))
  })

  test('Provides correct client details to RefreshingAuthProvider and saves admin refresh token when available', async () => {
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockResolvedValue(storedAdminToken)
    mockRefreshingAuthProvider.getIntentsForUser.calledWith(adminTwitchUserId).mockReturnValue(['chat'])

    await twurpleAuthProvider.initialise()

    const config = single2(mockRefreshingAuthProviderFactory.create.mock.calls)
    expect(config).toEqual(expectObject(config, { clientId, clientSecret }))

    const refreshedToken = cast<AccessToken>({ refreshToken: 'refreshed' })
    await config.onRefresh!(adminTwitchUserId, refreshedToken)

    const args = single(mockAuthStore.saveTwitchAccessToken.mock.calls)
    expect(args).toEqual(expectArray(args, [adminTwitchUsername, adminTwitchUserId, refreshedToken])) // order of args is wrong?! but it's passing
  })

  test(`Saves streamer's access token when refreshed successfully`, async () => {
    const streamerTwitchUserId = 'streamerUserId' as string & AccessToken
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockResolvedValue(storedAdminToken)
    mockRefreshingAuthProvider.getIntentsForUser.calledWith(streamerTwitchUserId).mockReturnValue([])

    await twurpleAuthProvider.initialise()

    const refreshedToken = cast<AccessToken>({ refreshToken: 'refreshed' })
    const { onRefresh } = single2(mockRefreshingAuthProviderFactory.create.mock.calls)
    await onRefresh!(streamerTwitchUserId, refreshedToken)

    const args = single(mockAuthStore.saveTwitchAccessToken.mock.calls)
    expect(args).toEqual(expectArray(args, [streamerTwitchUserId, null, refreshedToken]))
  })

  test(`Removes streamer's access token when refreshing failed`, async () => {
    const streamerTwitchUserId = 'streamerUserId' as string & AccessToken
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockResolvedValue(storedAdminToken)
    mockRefreshingAuthProvider.getIntentsForUser.calledWith(streamerTwitchUserId).mockReturnValue([])

    await twurpleAuthProvider.initialise()

    const { onRefreshFailure } = single2(mockRefreshingAuthProviderFactory.create.mock.calls)
    await onRefreshFailure!(streamerTwitchUserId)

    const deletedUserId = single2(mockAuthStore.tryDeleteTwitchAccessToken.mock.calls)
    expect(deletedUserId).toBe(streamerTwitchUserId)
    expect(single2(mockRefreshingAuthProvider.removeUser.mock.calls)).toBe(streamerTwitchUserId)
  })

  test('Uses client id and client secret for the ClientCredentialsAuthProvider', async () => {
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockResolvedValue(storedAdminToken)

    await twurpleAuthProvider.initialise()

    const [providedClientId, providedClientSecret] = single(mockAppTokenAuthProviderFactory.create.mock.calls)
    expect(providedClientId).toBe(clientId)
    expect(providedClientSecret).toBe(clientSecret)
  })

  test('Throws if stored scope differs from expected scope', async () => {
    const loadedToken = cast<AccessToken>({ scope: ['differentScope'] })
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockResolvedValue(loadedToken)

    await expect(twurpleAuthProvider.initialise()).rejects.toThrow()
  })
})

describe(nameof(TwurpleAuthProvider, 'getUserTokenAuthProvider'), () => {
  const userId = 'twitchUserId' as string & AccessToken

  beforeEach(async () => {
    const storedAdminToken = cast<AccessToken>({ accessToken: 'loaded access token', refreshToken: 'loaded refresh token', scope: TWITCH_SCOPE })
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockResolvedValue(storedAdminToken)
    await twurpleAuthProvider.initialise()
  })

  test('Returns the authProvider if the user has already been added with the correct scopes', async () => {
    mockRefreshingAuthProvider.hasUser.calledWith(userId).mockReturnValue(true)
    mockRefreshingAuthProvider.getCurrentScopesForUser.calledWith(userId).mockReturnValue(TWITCH_SCOPE)

    const result = await twurpleAuthProvider.getUserTokenAuthProvider(userId)

    expect(result).toBe(mockRefreshingAuthProvider)
  })

  test(`Adds the user and its token to the authProvider if it doesn't already exist`, async () => {
    const accessToken = cast<AccessTokenWithUserId>({ accessToken: 'refreshed token' })
    mockRefreshingAuthProvider.hasUser.calledWith(userId).mockReturnValue(false)
    mockAuthStore.loadTwitchAccessToken.calledWith(userId).mockResolvedValue(accessToken)
    mockRefreshingAuthProvider.refreshAccessTokenForUser.calledWith(userId).mockResolvedValue(cast<AccessTokenWithUserId>({}))
    mockRefreshingAuthProvider.getIntentsForUser.calledWith(userId).mockReturnValue([])
    mockRefreshingAuthProvider.getCurrentScopesForUser.calledWith(userId).mockReturnValue(TWITCH_SCOPE)

    const result = await twurpleAuthProvider.getUserTokenAuthProvider(userId)

    expect(result).toBe(mockRefreshingAuthProvider)

    const args = single(mockRefreshingAuthProvider.addUser.mock.calls)
    expect(args).toEqual(expectArray(args, [userId, accessToken]))
  })

  test(`Throws ${NotAuthorisedError.name} if the user has not yet provided authorisation for ChatMate`, async () => {
    mockRefreshingAuthProvider.hasUser.calledWith(userId).mockReturnValue(false)
    mockAuthStore.loadTwitchAccessToken.calledWith(userId).mockRejectedValue(new Error())

    await expect(() => twurpleAuthProvider.getUserTokenAuthProvider(userId)).rejects.toThrowError(NotAuthorisedError)
  })

  test(`Throws ${AuthorisationExpiredError.name} if the user has provided authorisation, but it has expired`, async () => {
    mockRefreshingAuthProvider.hasUser.calledWith(userId).mockReturnValue(false)
    mockAuthStore.loadTwitchAccessToken.calledWith(userId).mockResolvedValue(cast<AccessToken>({}))
    mockRefreshingAuthProvider.refreshAccessTokenForUser.calledWith(userId).mockRejectedValue(new Error('Expired refresh token'))
    mockRefreshingAuthProvider.getIntentsForUser.calledWith(userId).mockReturnValue([])

    await expect(() => twurpleAuthProvider.getUserTokenAuthProvider(userId)).rejects.toThrowError(AuthorisationExpiredError)

    expect(single2(mockAuthStore.tryDeleteTwitchAccessToken.mock.calls)).toBe(userId)
  })

  test(`Throws ${InconsistentScopesError.name} if the user has provided authorisation, but the scopes have since changed`, async () => {
    mockRefreshingAuthProvider.hasUser.calledWith(userId).mockReturnValue(false)
    mockAuthStore.loadTwitchAccessToken.calledWith(userId).mockResolvedValue(cast<AccessToken>({}))
    mockRefreshingAuthProvider.refreshAccessTokenForUser.calledWith(userId).mockResolvedValue(cast<AccessTokenWithUserId>({}))
    mockRefreshingAuthProvider.getIntentsForUser.calledWith(userId).mockReturnValue([])
    mockRefreshingAuthProvider.getCurrentScopesForUser.calledWith(userId).mockReturnValue(['different.scope'])

    await expect(() => twurpleAuthProvider.getUserTokenAuthProvider(userId, true)).rejects.toThrowError(InconsistentScopesError)
  })

  test(`Does not throw ${InconsistentScopesError.name} if the scopes have changed and the 'checkScopes' flag is not provided`, async () => {
    mockRefreshingAuthProvider.hasUser.calledWith(userId).mockReturnValue(false)
    mockAuthStore.loadTwitchAccessToken.calledWith(userId).mockResolvedValue(cast<AccessToken>({}))
    mockRefreshingAuthProvider.refreshAccessTokenForUser.calledWith(userId).mockResolvedValue(cast<AccessTokenWithUserId>({}))
    mockRefreshingAuthProvider.getIntentsForUser.calledWith(userId).mockReturnValue([])
    mockRefreshingAuthProvider.getCurrentScopesForUser.calledWith(userId).mockReturnValue(['different.scope'])

    const result = await twurpleAuthProvider.getUserTokenAuthProvider(userId)

    expect(result).toBe(mockRefreshingAuthProvider)
  })
})
