import { Dependencies } from '@rebel/shared/context/context'
import AppTokenAuthProviderFactory from '@rebel/server/factories/AppTokenAuthProviderFactory'
import RefreshingAuthProviderFactory from '@rebel/server/factories/RefreshingAuthProviderFactory'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import AuthStore from '@rebel/server/stores/AuthStore'
import { cast, expectArray, expectObject, nameof } from '@rebel/shared/testUtils'
import { single, single2 } from '@rebel/shared/util/arrays'
import { AccessToken, AccessTokenWithUserId, AppTokenAuthProvider, RefreshingAuthProvider, StaticAuthProvider } from '@twurple/auth'
import { mock, MockProxy } from 'jest-mock-extended'
import { AuthorisationExpiredError, ChatMateError, InconsistentScopesError, NotFoundError, TwitchNotAuthorisedError } from '@rebel/shared/util/error'
import AuthHelpers from '@rebel/server/helpers/AuthHelpers'
import StaticAuthProviderFactory from '@rebel/server/factories/StaticAuthProviderFactory'

const adminTwitchUserId = 'admin id' as string & AccessToken

let clientId: string
let clientSecret: string
let adminTwitchUsername: string
let studioUrl: string
let mockAuthStore: MockProxy<AuthStore>
let mockRefreshingAuthProvider: MockProxy<RefreshingAuthProvider>
let mockRefreshingAuthProviderFactory: MockProxy<RefreshingAuthProviderFactory>
let mockClientCredentialsAuthProvider: MockProxy<AppTokenAuthProvider>
let mockAppTokenAuthProviderFactory: MockProxy<AppTokenAuthProviderFactory>
let mockAuthHelpers: MockProxy<AuthHelpers>
let mockStaticAuthProviderFactory: MockProxy<StaticAuthProviderFactory>
let twurpleAuthProvider: TwurpleAuthProvider

beforeEach(() => {
  clientId = 'client id'
  clientSecret = 'client secret'
  adminTwitchUsername = 'twitch username'
  studioUrl = 'studioUrl'
  mockAuthStore = mock()
  mockRefreshingAuthProvider = mock()
  mockRefreshingAuthProviderFactory = mock()
  mockClientCredentialsAuthProvider = mock()
  mockAppTokenAuthProviderFactory = mock()
  mockAuthHelpers = mock()
  mockStaticAuthProviderFactory = mock()

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
    appTokenAuthProviderFactory: mockAppTokenAuthProviderFactory,
    studioUrl: studioUrl,
    authHelpers: mockAuthHelpers,
    staticAuthProviderFactory: mockStaticAuthProviderFactory
  }))
})

describe(nameof(TwurpleAuthProvider, 'initialise'), () => {
  const storedAdminToken = cast<AccessToken>({ accessToken: 'loaded access token', refreshToken: 'loaded refresh token', scope: ['correctScope'] })

  test('Throws if access token failed to load for RefreshingAuthProvider', async () => {
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockRejectedValue(new ChatMateError('Test'))

    await expect(() => twurpleAuthProvider.initialise()).rejects.toThrowError(ChatMateError)
  })

  test('Uses loaded admion token details if access token exists for RefreshingAuthProvider', async () => {
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockResolvedValue(storedAdminToken)
    mockAuthHelpers.compareTwitchScopes.calledWith('admin', storedAdminToken.scope).mockReturnValue(true)

    await twurpleAuthProvider.initialise()

    const args = single(mockRefreshingAuthProvider.addUserForToken.mock.calls)
    expect(args).toEqual(expectArray(args, [storedAdminToken, ['chat']]))
  })

  test('Provides correct client details to RefreshingAuthProvider and saves admin refresh token when available', async () => {
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockResolvedValue(storedAdminToken)
    mockAuthHelpers.compareTwitchScopes.calledWith('admin', storedAdminToken.scope).mockReturnValue(true)
    mockRefreshingAuthProvider.getIntentsForUser.calledWith(adminTwitchUserId).mockReturnValue(['chat'])

    await twurpleAuthProvider.initialise()

    const config = single2(mockRefreshingAuthProviderFactory.create.mock.calls)
    expect(config).toEqual(expectObject(config, { clientId, clientSecret }))

    const refreshedToken = cast<AccessToken>({ refreshToken: 'refreshed' })
    const onRefresh = single2(mockRefreshingAuthProvider.onRefresh.mock.calls)
    await onRefresh(adminTwitchUserId, refreshedToken)

    const args = single(mockAuthStore.saveTwitchAccessToken.mock.calls)
    expect(args).toEqual(expectArray(args, [adminTwitchUsername, adminTwitchUserId, refreshedToken])) // order of args is wrong?! but it's passing
  })

  test(`Saves streamer's access token when refreshed successfully`, async () => {
    const streamerTwitchUserId = 'streamerUserId' as string & AccessToken
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockResolvedValue(storedAdminToken)
    mockAuthHelpers.compareTwitchScopes.calledWith('admin', storedAdminToken.scope).mockReturnValue(true)
    mockRefreshingAuthProvider.getIntentsForUser.calledWith(streamerTwitchUserId).mockReturnValue([])

    await twurpleAuthProvider.initialise()

    const refreshedToken = cast<AccessToken>({ refreshToken: 'refreshed' })
    const onRefresh = single2(mockRefreshingAuthProvider.onRefresh.mock.calls)
    await onRefresh(streamerTwitchUserId, refreshedToken)

    const args = single(mockAuthStore.saveTwitchAccessToken.mock.calls)
    expect(args).toEqual(expectArray(args, [streamerTwitchUserId, null, refreshedToken]))
  })

  test(`Removes streamer's access token when refreshing failed`, async () => {
    const streamerTwitchUserId = 'streamerUserId' as string & AccessToken
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockResolvedValue(storedAdminToken)
    mockAuthHelpers.compareTwitchScopes.calledWith('admin', storedAdminToken.scope).mockReturnValue(true)
    mockRefreshingAuthProvider.getIntentsForUser.calledWith(streamerTwitchUserId).mockReturnValue([])

    await twurpleAuthProvider.initialise()

    const onRefreshFailure = single2(mockRefreshingAuthProvider.onRefreshFailure.mock.calls)
    await onRefreshFailure(streamerTwitchUserId, new Error())

    const deletedUserId = single2(mockAuthStore.tryDeleteTwitchAccessToken.mock.calls)
    expect(deletedUserId).toBe(streamerTwitchUserId)
    expect(single2(mockRefreshingAuthProvider.removeUser.mock.calls)).toBe(streamerTwitchUserId)
  })

  test('Uses client id and client secret for the ClientCredentialsAuthProvider', async () => {
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockResolvedValue(storedAdminToken)
    mockAuthHelpers.compareTwitchScopes.calledWith('admin', storedAdminToken.scope).mockReturnValue(true)

    await twurpleAuthProvider.initialise()

    const [providedClientId, providedClientSecret] = single(mockAppTokenAuthProviderFactory.create.mock.calls)
    expect(providedClientId).toBe(clientId)
    expect(providedClientSecret).toBe(clientSecret)
  })

  test('Throws if stored scope differs from expected scope', async () => {
    const loadedToken = cast<AccessToken>({ scope: ['differentScope'] })
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockResolvedValue(loadedToken)
    mockAuthHelpers.compareTwitchScopes.calledWith('admin', loadedToken.scope).mockReturnValue(false)

    await expect(twurpleAuthProvider.initialise()).rejects.toThrowError(ChatMateError)
  })
})

describe(nameof(TwurpleAuthProvider, 'getUserTokenAuthProvider'), () => {
  const userId = 'twitchUserId' as string & AccessToken
  const correctScope = ['correctScope']

  beforeEach(async () => {
    const storedAdminToken = cast<AccessToken>({ accessToken: 'loaded access token', refreshToken: 'loaded refresh token', scope: ['adminScope'] })
    mockAuthStore.loadTwitchAccessTokenByChannelName.calledWith(adminTwitchUsername).mockResolvedValue(storedAdminToken)
    mockAuthHelpers.compareTwitchScopes.calledWith('admin', storedAdminToken.scope).mockReturnValue(true)
    await twurpleAuthProvider.initialise()
  })

  test('Returns the authProvider if the user has already been added with the correct scopes', async () => {
    mockRefreshingAuthProvider.hasUser.calledWith(userId).mockReturnValue(true)
    mockRefreshingAuthProvider.getCurrentScopesForUser.calledWith(userId).mockReturnValue(correctScope)
    mockAuthHelpers.compareTwitchScopes.calledWith('streamer', correctScope).mockReturnValue(true)

    const result = await twurpleAuthProvider.getUserTokenAuthProvider(userId)

    expect(result).toBe(mockRefreshingAuthProvider)
  })

  test(`Adds the user and its token to the authProvider if it doesn't already exist`, async () => {
    const accessToken = cast<AccessTokenWithUserId>({ accessToken: 'refreshed token' })
    mockRefreshingAuthProvider.hasUser.calledWith(userId).mockReturnValue(false)
    mockAuthStore.loadTwitchAccessToken.calledWith(userId).mockResolvedValue(accessToken)
    mockRefreshingAuthProvider.refreshAccessTokenForUser.calledWith(userId).mockResolvedValue(cast<AccessTokenWithUserId>({}))
    mockRefreshingAuthProvider.getIntentsForUser.calledWith(userId).mockReturnValue([])
    mockRefreshingAuthProvider.getCurrentScopesForUser.calledWith(userId).mockReturnValue(correctScope)
    mockAuthHelpers.compareTwitchScopes.calledWith('streamer', correctScope).mockReturnValue(true)

    const result = await twurpleAuthProvider.getUserTokenAuthProvider(userId)

    expect(result).toBe(mockRefreshingAuthProvider)

    const args = single(mockRefreshingAuthProvider.addUser.mock.calls)
    expect(args).toEqual(expectArray(args, [userId, accessToken]))
  })

  test(`Throws ${TwitchNotAuthorisedError.name} if the user has not yet provided authorisation for ChatMate`, async () => {
    mockRefreshingAuthProvider.hasUser.calledWith(userId).mockReturnValue(false)
    mockAuthStore.loadTwitchAccessToken.calledWith(userId).mockRejectedValue(new NotFoundError(''))

    await expect(() => twurpleAuthProvider.getUserTokenAuthProvider(userId)).rejects.toThrowError(TwitchNotAuthorisedError)
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
    const wrongScope = ['different.scope']
    mockRefreshingAuthProvider.hasUser.calledWith(userId).mockReturnValue(false)
    mockAuthStore.loadTwitchAccessToken.calledWith(userId).mockResolvedValue(cast<AccessToken>({}))
    mockRefreshingAuthProvider.refreshAccessTokenForUser.calledWith(userId).mockResolvedValue(cast<AccessTokenWithUserId>({}))
    mockRefreshingAuthProvider.getIntentsForUser.calledWith(userId).mockReturnValue([])
    mockRefreshingAuthProvider.getCurrentScopesForUser.calledWith(userId).mockReturnValue(wrongScope)
    mockAuthHelpers.compareTwitchScopes.calledWith('streamer', wrongScope).mockReturnValue(false)

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

describe(nameof(TwurpleAuthProvider, 'revokeAccessToken'), () => {
  const accessToken = 'accessToken'

  test('Returns true if the request succeeded', async () => {
    mockAuthHelpers.revokeTwitchAccessToken.calledWith(clientId, accessToken).mockResolvedValue()

    const result = await twurpleAuthProvider.revokeAccessToken(accessToken)

    expect(result).toBe(true)
  })

  test('Returns false if the request did not succeed', async () => {
    mockAuthHelpers.revokeTwitchAccessToken.calledWith(clientId, accessToken).mockRejectedValue(new Error('test'))

    const result = await twurpleAuthProvider.revokeAccessToken(accessToken)

    expect(result).toBe(false)
  })
})

describe(nameof(TwurpleAuthProvider, 'getLoginUrl'), () => {
  test('Returns a URL', () => {
    const scope = 'scope'
    mockAuthHelpers.getTwitchScope.calledWith('streamer').mockReturnValue([scope])

    const url = twurpleAuthProvider.getLoginUrl('streamer')

    expect(url).toEqual(expect.stringContaining(studioUrl))
    expect(url).toEqual(expect.stringContaining(clientId))
    expect(url).toEqual(expect.stringContaining(scope))
  })
})

describe(nameof(TwurpleAuthProvider, 'getAuthorisationUrl'), () => {
  test('Returns a URL', () => {
    const code = 'code'

    const url = twurpleAuthProvider.getAuthorisationUrl('streamer', code)

    expect(url).toEqual(expect.stringContaining(studioUrl))
    expect(url).toEqual(expect.stringContaining(clientId))
    expect(url).toEqual(expect.stringContaining(clientSecret))
    expect(url).toEqual(expect.stringContaining(code))
  })
})
