import { Dependencies } from '@rebel/shared/context/context'
import ClientCredentialsAuthProviderFactory from '@rebel/server/factories/ClientCredentialsAuthProviderFactory'
import RefreshingAuthProviderFactory from '@rebel/server/factories/RefreshingAuthProviderFactory'
import TwurpleAuthProvider, { TWITCH_SCOPE } from '@rebel/server/providers/TwurpleAuthProvider'
import AuthStore from '@rebel/server/stores/AuthStore'
import { nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/shared/util/arrays'
import { AccessToken, ClientCredentialsAuthProvider, RefreshingAuthProvider } from '@twurple/auth'
import { mock, MockProxy } from 'jest-mock-extended'

let clientId: string
let clientSecret: string
let mockAuthStore: MockProxy<AuthStore>
let mockRefreshingAuthProvider: MockProxy<RefreshingAuthProvider>
let mockRefreshingAuthProviderFactory: MockProxy<RefreshingAuthProviderFactory>
let mockClientCredentialsAuthProvider: MockProxy<ClientCredentialsAuthProvider>
let mockClientCredentialsAuthProviderFactory: MockProxy<ClientCredentialsAuthProviderFactory>
let twurpleAuthProvider: TwurpleAuthProvider

beforeEach(() => {
  clientId = 'client id'
  clientSecret = 'client secret'
  mockAuthStore = mock()
  mockRefreshingAuthProvider = mock()
  mockRefreshingAuthProviderFactory = mock()
  mockClientCredentialsAuthProvider = mock()
  mockClientCredentialsAuthProviderFactory = mock()

  mockRefreshingAuthProviderFactory.create.calledWith(expect.anything(), expect.anything()).mockReturnValue(mockRefreshingAuthProvider)
  mockClientCredentialsAuthProviderFactory.create.calledWith(clientId, clientSecret).mockReturnValue(mockClientCredentialsAuthProvider)

  twurpleAuthProvider = new TwurpleAuthProvider(new Dependencies({
    disableExternalApis: false,
    nodeEnv: 'release',
    twitchClientId: clientId,
    twitchClientSecret: clientSecret,
    logService: mock(),
    authStore: mockAuthStore,
    refreshingAuthProviderFactory: mockRefreshingAuthProviderFactory,
    clientCredentialsAuthProviderFactory: mockClientCredentialsAuthProviderFactory
  }))
})

describe(nameof(TwurpleAuthProvider, 'initialise'), () => {
  test('throws if access token failed to load for RefreshingAuthProvider', async () => {
    mockAuthStore.loadTwitchAccessToken.calledWith().mockRejectedValue(new Error('Test'))

    await expect(() => twurpleAuthProvider.initialise()).rejects.toThrow()
  })

  test('uses loaded token details if access token exists for RefreshingAuthProvider', async () => {
    const loadedToken: Partial<AccessToken> = { accessToken: 'loaded access token', refreshToken: 'loaded refresh token', scope: TWITCH_SCOPE }
    mockAuthStore.loadTwitchAccessToken.calledWith().mockResolvedValue(loadedToken as AccessToken)

    await twurpleAuthProvider.initialise()

    const [_, initialToken] = single(mockRefreshingAuthProviderFactory.create.mock.calls)
    expect(initialToken.accessToken).toBe(loadedToken.accessToken)
    expect(initialToken.refreshToken).toBe(loadedToken.refreshToken)
  })

  test('provides correct client details to RefreshingAuthProvider and saves refresh token when available', async () => {
    const loadedToken: Partial<AccessToken> = { accessToken: 'loaded access token', refreshToken: 'loaded refresh token', scope: TWITCH_SCOPE }
    mockAuthStore.loadTwitchAccessToken.calledWith().mockResolvedValue(loadedToken as AccessToken)

    await twurpleAuthProvider.initialise()

    const [config, _] = single(mockRefreshingAuthProviderFactory.create.mock.calls)
    expect(config.clientId).toBe(clientId)
    expect(config.clientSecret).toBe(clientSecret)

    const refreshedToken: AccessToken = {} as any
    await config.onRefresh!(refreshedToken)
    expect(single(single(mockAuthStore.saveTwitchAccessToken.mock.calls))).toBe(refreshedToken)
  })

  test('uses client id and client secret for the ClientCredentialsAuthProvider', async () => {
    const loadedToken: Partial<AccessToken> = { accessToken: 'loaded access token', refreshToken: 'loaded refresh token', scope: TWITCH_SCOPE }
    mockAuthStore.loadTwitchAccessToken.calledWith().mockResolvedValue(loadedToken as AccessToken)

    await twurpleAuthProvider.initialise()

    const [providedClientId, providedClientSecret] = single(mockClientCredentialsAuthProviderFactory.create.mock.calls)
    expect(providedClientId).toBe(clientId)
    expect(providedClientSecret).toBe(clientSecret)
  })

  test('throws if stored scope differs from expected scope', async () => {
    const loadedToken: Partial<AccessToken> = { scope: ['differentScope'] }
    mockAuthStore.loadTwitchAccessToken.calledWith().mockResolvedValue(loadedToken as AccessToken)

    await expect(twurpleAuthProvider.initialise()).rejects.toThrow()
  })
})
