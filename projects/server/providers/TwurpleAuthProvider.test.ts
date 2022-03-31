import { Dependencies } from '@rebel/server/context/context'
import RefreshingAuthProviderFactory from '@rebel/server/factories/RefreshingAuthProviderFactory'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import AuthStore from '@rebel/server/stores/AuthStore'
import { nameof, single } from '@rebel/server/_test/utils'
import { AccessToken, RefreshingAuthProvider } from '@twurple/auth'
import { DeepMockProxy, mock, MockProxy } from 'jest-mock-extended'

let clientId: string
let clientSecret: string
let accessToken: string | null
let refreshToken: string | null
let mockAuthStore: MockProxy<AuthStore>
let mockRefreshingAuthProvider: MockProxy<RefreshingAuthProvider>
let mockRefreshingAuthProviderFactory: MockProxy<RefreshingAuthProviderFactory>
let twurpleAuthProvider: TwurpleAuthProvider

beforeEach(() => {
  clientId = 'client id'
  clientSecret = 'client secret'
  accessToken = 'access token'
  refreshToken = 'refresh token'
  mockAuthStore = mock()
  mockRefreshingAuthProvider = mock()
  mockRefreshingAuthProviderFactory = mock()
  
  mockRefreshingAuthProviderFactory.create.mockReturnValue(mockRefreshingAuthProvider)

  twurpleAuthProvider = new TwurpleAuthProvider(new Dependencies({
    isLive: true,
    twitchClientId: clientId,
    twitchClientSecret: clientSecret,
    twitchAccessToken: accessToken,
    twitchRefreshToken: refreshToken,
    logService: mock(),
    authStore: mockAuthStore,
    refreshingAuthProviderFactory: mockRefreshingAuthProviderFactory
  }))
})

describe(nameof(TwurpleAuthProvider, 'initialise'), () => {
  test('throws if access token failed to load', async () => {
    mockAuthStore.loadAccessToken.mockRejectedValue(new Error('Test'))

    await expect(() => twurpleAuthProvider.initialise()).rejects.toThrow()
  })

  test('uses fallback token details if no access token exists', async () => {
    mockAuthStore.loadAccessToken.mockResolvedValue(null)

    await twurpleAuthProvider.initialise()

    const [_, initialToken] = single(mockRefreshingAuthProviderFactory.create.mock.calls)
    expect(initialToken.accessToken).toBe(accessToken)
    expect(initialToken.refreshToken).toBe(refreshToken)
  })

  test('uses loaded token details if access token exists', async () => {
    const loadedToken: Partial<AccessToken> = { accessToken: 'loaded access token', refreshToken: 'loaded refresh token' }
    mockAuthStore.loadAccessToken.mockResolvedValue(loadedToken as AccessToken)

    await twurpleAuthProvider.initialise()

    const [_, initialToken] = single(mockRefreshingAuthProviderFactory.create.mock.calls)
    expect(initialToken.accessToken).toBe(loadedToken.accessToken)
    expect(initialToken.refreshToken).toBe(loadedToken.refreshToken)
  })

  test('provides correct client details and saves refresh token when available', async () => {
    await twurpleAuthProvider.initialise()

    const [config, _] = single(mockRefreshingAuthProviderFactory.create.mock.calls)
    expect(config.clientId).toBe(clientId)
    expect(config.clientSecret).toBe(clientSecret)

    const refreshedToken: AccessToken = {} as any
    await config.onRefresh!(refreshedToken)
    expect(single(single(mockAuthStore.saveAccessToken.mock.calls))).toBe(refreshedToken)
  })
})