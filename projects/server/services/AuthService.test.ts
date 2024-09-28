import AuthHelpers from '@rebel/server/helpers/AuthHelpers'
import YoutubeAuthProvider from '@rebel/server/providers/YoutubeAuthProvider'
import AuthService from '@rebel/server/services/AuthService'
import YoutubeApiProxyService from '@rebel/server/services/YoutubeApiProxyService'
import AuthStore from '@rebel/server/stores/AuthStore'
import StreamerChannelStore, { PrimaryChannels } from '@rebel/server/stores/StreamerChannelStore'
import { Dependencies } from '@rebel/shared/context/context'
import { CalledWithMock, MockProxy, mock } from 'jest-mock-extended'
import { OAuth2Client, Credentials } from 'google-auth-library'
import { cast, expectArray, nameof } from '@rebel/shared/testUtils'
import { single2 } from '@rebel/shared/util/arrays'
import { ChatMateError, InconsistentScopesError, InvalidAuthenticatedChannelError, PrimaryChannelNotFoundError } from '@rebel/shared/util/error'

// jest is having trouble mocking the correct overload method, so we have to force it into the correct type
type GetAuthToken = CalledWithMock<Promise<{ tokens: Credentials }>, [code: string]>
type RevokeAuthToken = CalledWithMock<Promise<{ data: { success: boolean }}>, [token: string]>

const chatMateAdminChannelId = 'chatMateAdminChannelId'
let mockAuthClient: MockProxy<OAuth2Client>
let mockAuthHelpers: MockProxy<AuthHelpers>
let mockAuthStore: MockProxy<AuthStore>
let mockStreamerChannelStore: MockProxy<StreamerChannelStore>
let mockYoutubeApiProxyService: MockProxy<YoutubeApiProxyService>
let mockYoutubeAuthProvider: MockProxy<YoutubeAuthProvider>
let authService: AuthService

beforeEach(() => {
  mockAuthClient = mock()
  mockAuthHelpers = mock()
  mockAuthStore = mock()
  mockStreamerChannelStore = mock()
  mockYoutubeApiProxyService = mock()
  mockYoutubeAuthProvider = mock()

  authService = new AuthService(new Dependencies({
    authHelpers: mockAuthHelpers,
    authStore: mockAuthStore,
    channelId: chatMateAdminChannelId,
    logService: mock(),
    streamerChannelStore: mockStreamerChannelStore,
    youtubeApiProxyService: mockYoutubeApiProxyService,
    youtubeAuthProvider: mockYoutubeAuthProvider
  }))
})

describe(nameof(AuthService, 'authoriseYoutubeAdmin'), () => {
  const code = 'code'
  const token: Credentials = { scope: 'scope', access_token: 'access_token' }

  beforeEach(() => {
    (mockAuthClient.getToken as any as GetAuthToken).calledWith(code).mockResolvedValue({ tokens: token })
    mockYoutubeAuthProvider.getClient.calledWith('admin').mockReturnValue(mockAuthClient)
  })

  test('Saves access token', async () => {
    mockAuthHelpers.compareYoutubeScopes.calledWith('admin', expectArray([token.scope!])).mockReturnValue(true)
    mockYoutubeApiProxyService.getOwnedChannels.calledWith(token).mockResolvedValue([{ id: chatMateAdminChannelId, name: '', image: '' }])

    await authService.authoriseYoutubeAdmin(code)

    const savedToken = single2(mockAuthStore.saveYoutubeAccessToken.mock.calls)
    expect(savedToken.accessToken).toBe(token.access_token)
    expect(savedToken.externalYoutubeChannelId).toBe(chatMateAdminChannelId)
    expect(mockAuthClient.revokeToken.mock.calls.length).toBe(0)
  })

  test(`Throws ${InconsistentScopesError.name} if the user's approved scopes don't match the expected ones`, async () => {
    mockAuthHelpers.compareYoutubeScopes.calledWith('admin', expectArray([token.scope!])).mockReturnValue(false);
    (mockAuthClient.revokeToken as any as RevokeAuthToken).calledWith(token.access_token!).mockResolvedValue({ data: { success: true }})

    await expect(() => authService.authoriseYoutubeAdmin(code)).rejects.toThrowError(InconsistentScopesError)

    expect(single2(mockAuthClient.revokeToken.mock.calls)).toBe(token.access_token)
  })

  test(`Throws ${InvalidAuthenticatedChannelError.name} if the user does not own the expected channel`, async () => {
    mockAuthHelpers.compareYoutubeScopes.calledWith('admin', expectArray([token.scope!])).mockReturnValue(true)
    mockYoutubeApiProxyService.getOwnedChannels.calledWith(token).mockResolvedValue([{ id: 'wrongId', name: '', image: '' }]);
    (mockAuthClient.revokeToken as any as RevokeAuthToken).calledWith(token.access_token!).mockResolvedValue({ data: { success: true }})

    await expect(() => authService.authoriseYoutubeAdmin(code)).rejects.toThrowError(InvalidAuthenticatedChannelError)

    expect(single2(mockAuthClient.revokeToken.mock.calls)).toBe(token.access_token)
  })
})

describe(nameof(AuthService, 'authoriseYoutubeStreamer'), () => {
  const streamerId = 4
  const externalChannelId = 'externalChannelId'
  const code = 'code'
  const token: Credentials = { scope: 'scope', access_token: 'access_token' }

  beforeEach(() => {
    (mockAuthClient.getToken as any as GetAuthToken).calledWith(code).mockResolvedValue({ tokens: token })
    mockYoutubeAuthProvider.getClient.calledWith('streamer').mockReturnValue(mockAuthClient)
  })

  test('Saves access token', async () => {
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray([streamerId])).mockResolvedValue(cast<PrimaryChannels[]>([{ youtubeChannel: { platformInfo: { channel: { youtubeId: externalChannelId }}} }]))
    mockAuthHelpers.compareYoutubeScopes.calledWith('streamer', expectArray([token.scope!])).mockReturnValue(true)
    mockYoutubeApiProxyService.getOwnedChannels.calledWith(token).mockResolvedValue([{ id: externalChannelId, name: '', image: '' }])

    await authService.authoriseYoutubeStreamer(code, streamerId)

    const savedToken = single2(mockAuthStore.saveYoutubeAccessToken.mock.calls)
    expect(savedToken.accessToken).toBe(token.access_token)
    expect(savedToken.externalYoutubeChannelId).toBe(externalChannelId)
    expect(mockAuthClient.revokeToken.mock.calls.length).toBe(0)
  })

  test(`Throws ${PrimaryChannelNotFoundError.name} if the user does not have a primary Youtube channel`, async () => {
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray([streamerId])).mockResolvedValue(cast<PrimaryChannels[]>([{ }]))

    await expect(() => authService.authoriseYoutubeStreamer(code, streamerId)).rejects.toThrowError(PrimaryChannelNotFoundError)
  })

  test(`Throws ${InconsistentScopesError.name} if the user's approved scopes don't match the expected ones`, async () => {
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray([streamerId])).mockResolvedValue(cast<PrimaryChannels[]>([{ youtubeChannel: { platformInfo: { channel: { youtubeId: externalChannelId }}} }]))
    mockAuthHelpers.compareYoutubeScopes.calledWith('streamer', expectArray([token.scope!])).mockReturnValue(false);
    (mockAuthClient.revokeToken as any as RevokeAuthToken).calledWith(token.access_token!).mockResolvedValue({ data: { success: true }})

    await expect(() => authService.authoriseYoutubeStreamer(code, streamerId)).rejects.toThrowError(InconsistentScopesError)

    expect(single2(mockAuthClient.revokeToken.mock.calls)).toBe(token.access_token)
  })

  test(`Throws ${InvalidAuthenticatedChannelError.name} if the user does not own the expected channel`, async () => {
    mockStreamerChannelStore.getPrimaryChannels.calledWith(expectArray([streamerId])).mockResolvedValue(cast<PrimaryChannels[]>([{ youtubeChannel: { platformInfo: { channel: { youtubeId: externalChannelId }}} }]))
    mockAuthHelpers.compareYoutubeScopes.calledWith('streamer', expectArray([token.scope!])).mockReturnValue(true)
    mockYoutubeApiProxyService.getOwnedChannels.calledWith(token).mockResolvedValue([{ id: 'wrongId', name: '', image: '' }]);
    (mockAuthClient.revokeToken as any as RevokeAuthToken).calledWith(token.access_token!).mockResolvedValue({ data: { success: true }})

    await expect(() => authService.authoriseYoutubeStreamer(code, streamerId)).rejects.toThrowError(InvalidAuthenticatedChannelError)

    expect(single2(mockAuthClient.revokeToken.mock.calls)).toBe(token.access_token)
  })
})

describe(nameof(AuthService, 'authoriseYoutubeUserAndGetChannel'), () => {
  const code = 'code'
  const token: Credentials = { scope: 'scope', access_token: 'access_token' }

  beforeEach(() => {
    (mockAuthClient.getToken as any as GetAuthToken).calledWith(code).mockResolvedValue({ tokens: token });
    (mockAuthClient.revokeToken as any as RevokeAuthToken).calledWith(token.access_token!).mockResolvedValue({ data: { success: true }})
    mockYoutubeAuthProvider.getClient.calledWith('user').mockReturnValue(mockAuthClient)
  })

  test('Authorises the user and returns channel information', async () => {
    const externalChannelId = 'externalChannelId'
    const channel = { id: externalChannelId, name: 'name', image: 'image' }

    mockAuthHelpers.compareYoutubeScopes.calledWith('user', expectArray([token.scope!])).mockReturnValue(true)
    mockYoutubeApiProxyService.getOwnedChannels.calledWith(token).mockResolvedValue([channel])

    const result = await authService.authoriseYoutubeUserAndGetChannel(code)

    expect(result).toEqual(channel)
    expect(single2(mockAuthClient.revokeToken.mock.calls)).toBe(token.access_token)
    expect(mockAuthStore.saveYoutubeAccessToken.mock.calls.length).toBe(0)
  })

  test(`Throws ${InconsistentScopesError.name} if the user's approved scopes don't match the expected ones`, async () => {
    mockAuthHelpers.compareYoutubeScopes.calledWith('user', expectArray([token.scope!])).mockReturnValue(false)

    await expect(() => authService.authoriseYoutubeUserAndGetChannel(code)).rejects.toThrowError(InconsistentScopesError)

    expect(single2(mockAuthClient.revokeToken.mock.calls)).toBe(token.access_token)
  })

  test(`Throws if the user has multiple channels`, async () => {
    mockAuthHelpers.compareYoutubeScopes.calledWith('user', expectArray([token.scope!])).mockReturnValue(true)
    mockYoutubeApiProxyService.getOwnedChannels.calledWith(token).mockResolvedValue([{}, {}] as any)

    await expect(() => authService.authoriseYoutubeUserAndGetChannel(code)).rejects.toThrowError(ChatMateError)

    expect(single2(mockAuthClient.revokeToken.mock.calls)).toBe(token.access_token)
  })
})
