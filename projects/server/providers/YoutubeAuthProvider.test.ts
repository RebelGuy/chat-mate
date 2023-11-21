/* eslint-disable @typescript-eslint/unbound-method */
import { YoutubeAuth } from '@prisma/client'
import YoutubeAuthClientFactory from '@rebel/server/factories/YoutubeAuthClientFactory'
import YoutubeAuthProvider from '@rebel/server/providers/YoutubeAuthProvider'
import AuthStore from '@rebel/server/stores/AuthStore'
import { Dependencies } from '@rebel/shared/context/context'
import { cast, expectObject, nameof } from '@rebel/shared/testUtils'
import { InconsistentScopesError, YoutubeNotAuthorisedError } from '@rebel/shared/util/error'
import { CalledWithMock, MockProxy, mock } from 'jest-mock-extended'
import { OAuth2Client, Credentials } from 'google-auth-library'
import { single, single2 } from '@rebel/shared/util/arrays'
import { YOUTUBE_SCOPE } from '@rebel/server/constants'

// jest is having trouble mocking the correct overload method, so we have to force it into the correct type
type GetAuthToken = CalledWithMock<Promise<{ tokens: Credentials }>, [code: string]>
type RevokeAuthToken = CalledWithMock<Promise<{ data: { success: boolean }}>, [token: string]>

const mockChannelId = 'channelId'
const mockStudioUrl = 'studioUrl'
const mockYoutubeClientId = 'mockYoutubeClientId'
const mockYoutubeClientSecret = 'mockYoutubeClientSecret'
const streamerChannelId = 'streamerChannelId'
let mockAuthStore: MockProxy<AuthStore>
let mockYoutubeAuthClientFactory: MockProxy<YoutubeAuthClientFactory>
let mockAuthClient: MockProxy<OAuth2Client>
let youtubeAuthProvider: YoutubeAuthProvider

beforeEach(() => {
  mockAuthStore = mock()
  mockYoutubeAuthClientFactory = mock()
  mockAuthClient = mock()

  mockYoutubeAuthClientFactory.create.calledWith(mockYoutubeClientId, mockYoutubeClientSecret, expect.any(String)).mockReturnValue(mockAuthClient)

  youtubeAuthProvider = new YoutubeAuthProvider(new Dependencies({
    authStore: mockAuthStore,
    channelId: mockChannelId,
    disableExternalApis: false,
    logService: mock(),
    studioUrl: mockStudioUrl,
    youtubeClientId: mockYoutubeClientId,
    youtubeClientSecret: mockYoutubeClientSecret,
    youtubeAuthClientFactory: mockYoutubeAuthClientFactory
  }))
})

describe(nameof(YoutubeAuthProvider, 'initialise'), () => {
  test(`Revokes token and throws ${YoutubeNotAuthorisedError.name} if saved admin token's scope's do not match the expected scopes`, async () => {
    const token = cast<YoutubeAuth>({ scope: '', accessToken: 'testToken' })
    mockAuthStore.loadYoutubeAccessToken.calledWith(mockChannelId).mockResolvedValue(token)

    await expect(() => youtubeAuthProvider.initialise()).rejects.toThrow(InconsistentScopesError)

    expect(single2(mockAuthClient.revokeToken.mock.calls)).toBe(token.accessToken)
    expect(single2(mockAuthStore.tryDeleteYoutubeAccessToken.mock.calls)).toBe(mockChannelId)
  })

  test(`Throws ${YoutubeNotAuthorisedError.name} if admin token not found`, async () => {
    mockAuthStore.loadYoutubeAccessToken.calledWith(mockChannelId).mockResolvedValue(null)

    await expect(() => youtubeAuthProvider.initialise()).rejects.toThrow(YoutubeNotAuthorisedError)
  })
})

describe(nameof(YoutubeAuthProvider, 'getAuthUrl'), () => {
  test('Generates the Auth URL', () => {
    const url = 'testUrl'
    mockAuthClient.generateAuthUrl.calledWith(expectObject({ client_id: mockYoutubeClientId })).mockReturnValue(url)

    const result = youtubeAuthProvider.getAuthUrl(false)

    expect(result).toBe(url)
  })
})

describe(nameof(YoutubeAuthProvider, 'authoriseChannel'), () => {
  test('Saves access token', async () => {
    const code = 'code'
    const token: Credentials = { scope: YOUTUBE_SCOPE.join(' '), access_token: 'test123' };
    (mockAuthClient.getToken as any as GetAuthToken).calledWith(code).mockResolvedValue({ tokens: token })

    await youtubeAuthProvider.authoriseChannel(code, streamerChannelId)

    const savedToken = single2(mockAuthStore.saveYoutubeAccessToken.mock.calls)
    expect(savedToken.accessToken).toBe(token.access_token)
    expect(savedToken.externalYoutubeChannelId).toBe(streamerChannelId)
  })

  test(`Throws ${InconsistentScopesError.name} if the user's approved scopes don't match the expected ones`, async () => {
    const code = 'code'
    const token: Credentials = { scope: '', access_token: 'test123' };
    (mockAuthClient.getToken as any as GetAuthToken).calledWith(code).mockResolvedValue({ tokens: token });
    (mockAuthClient.revokeToken as any as RevokeAuthToken).calledWith(token.access_token!).mockResolvedValue({ data: { success: true }})

    await expect(() => youtubeAuthProvider.authoriseChannel(code, streamerChannelId)).rejects.toThrowError(InconsistentScopesError)
  })
})

describe(nameof(YoutubeAuthProvider, 'getAuth'), () => {
  test(`Returns the client with correct credentials and listening to token updates`, async () => {
    const savedToken = cast<YoutubeAuth>({ scope: YOUTUBE_SCOPE.join(' '), accessToken: 'test123', expiryDate: new Date() })
    mockAuthStore.loadYoutubeAccessToken.calledWith(streamerChannelId).mockResolvedValue(savedToken)

    const result = await youtubeAuthProvider.getAuth(streamerChannelId)

    expect(result).toBe(mockAuthClient)

    const providedCredentials = single2(mockAuthClient.setCredentials.mock.calls)
    expect(providedCredentials).toEqual(expectObject(providedCredentials, { access_token: savedToken.accessToken }))

    // test that updated tokens are saved to the db
    const updateCallback = single(mockAuthClient.on.mock.calls)[1]
    const updatedCredentials = cast<Credentials>({ access_token: 'updatedToken', expiry_date: 1 })
    await updateCallback(updatedCredentials)

    const savedUpdatedToken = single2(mockAuthStore.saveYoutubeAccessToken.mock.calls)
    expect(savedUpdatedToken).toEqual(expectObject(savedUpdatedToken, { accessToken: updatedCredentials.access_token!, externalYoutubeChannelId: streamerChannelId }))
  })

  test(`Throws ${YoutubeNotAuthorisedError.name} if no token exists`, async () => {
    mockAuthStore.loadYoutubeAccessToken.calledWith(streamerChannelId).mockResolvedValue(null)

    await expect(() => youtubeAuthProvider.getAuth(streamerChannelId)).rejects.toThrowError(YoutubeNotAuthorisedError)
  })

  test(`Throws ${InconsistentScopesError.name} if the saved scope is invalid`, async () => {
    const savedToken = cast<YoutubeAuth>({ scope: '' })
    mockAuthStore.loadYoutubeAccessToken.calledWith(streamerChannelId).mockResolvedValue(savedToken)

    await expect(() => youtubeAuthProvider.getAuth(streamerChannelId)).rejects.toThrowError(InconsistentScopesError)
  })
})

describe(nameof(YoutubeAuthProvider, 'revokeYoutubeAccessToken'), () => {
  test('Revokes the access token and deletes it', async () => {
    const savedToken = cast<YoutubeAuth>({ accessToken: 'test123', expiryDate: new Date() })
    mockAuthStore.loadYoutubeAccessToken.calledWith(streamerChannelId).mockResolvedValue(savedToken)

    await youtubeAuthProvider.revokeYoutubeAccessToken(streamerChannelId)

    expect(single2(mockAuthClient.revokeToken.mock.calls)).toBe(savedToken.accessToken)
    expect(single2(mockAuthStore.tryDeleteYoutubeAccessToken.mock.calls)).toBe(streamerChannelId)
  })

  test(`Throws ${YoutubeNotAuthorisedError.name} if no token exists`, async () => {
    mockAuthStore.loadYoutubeAccessToken.calledWith(streamerChannelId).mockResolvedValue(null)

    await expect(() => youtubeAuthProvider.revokeYoutubeAccessToken(streamerChannelId)).rejects.toThrowError(YoutubeNotAuthorisedError)
  })
})
