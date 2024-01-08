import { RegisteredUser, Streamer } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import StreamerService from '@rebel/server/services/StreamerService'
import AccountStore from '@rebel/server/stores/AccountStore'
import RankStore from '@rebel/server/stores/RankStore'
import StreamerStore, { StreamerApplicationWithUser, CloseApplicationArgs, CreateApplicationArgs } from '@rebel/server/stores/StreamerStore'
import { single, single2 } from '@rebel/shared/util/arrays'
import { UserAlreadyStreamerError } from '@rebel/shared/util/error'
import { cast, expectArray, expectObject, nameof } from '@rebel/shared/testUtils'
import { mock, MockProxy } from 'jest-mock-extended'
import AuthStore from '@rebel/server/stores/AuthStore'
import StreamerChannelStore, { PrimaryChannels } from '@rebel/server/stores/StreamerChannelStore'
import WebService from '@rebel/server/services/WebService'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'

let mockStreamerStore: MockProxy<StreamerStore>
let mockRankStore: MockProxy<RankStore>
let mockAccountStore: MockProxy<AccountStore>
const mockTwitchClientId = 'clientId'
const mockStudioUrl = 'studioUrl'
let mockAuthStore: MockProxy<AuthStore>
let mockStreamerChannelStore: MockProxy<StreamerChannelStore>
const mockTwitchClientSecret = 'clientSecret'
let mockWebService: MockProxy<WebService>
let mockTwurpleAuthProvider: MockProxy<TwurpleAuthProvider>
let streamerService: StreamerService

beforeEach(() => {
  mockStreamerStore = mock()
  mockRankStore = mock()
  mockAccountStore = mock()
  mockAuthStore = mock()
  mockStreamerChannelStore = mock()
  mockWebService = mock()
  mockTwurpleAuthProvider = mock()

  streamerService = new StreamerService(new Dependencies({
    streamerStore: mockStreamerStore,
    rankStore: mockRankStore,
    accountStore: mockAccountStore,
    twitchClientId: mockTwitchClientId,
    studioUrl: mockStudioUrl,
    authStore: mockAuthStore,
    logService: mock(),
    streamerChannelStore: mockStreamerChannelStore,
    twitchClientSecret: mockTwitchClientSecret,
    webService: mockWebService,
    twurpleAuthProvider: mockTwurpleAuthProvider
  }))
})

describe(nameof(StreamerService, 'approveStreamerApplication'), () => {
  test('Instructs store to approve application and adds a new streamer, then notifies Twitch services, then adds the streamer rank to the chat user', async () => {
    const streamerApplicationId = 1
    const message = 'test'
    const closedApplication = cast<StreamerApplicationWithUser>({ registeredUserId: 2 })
    const registeredUserId = 58
    const streamer = cast<Streamer>({ id: 4, registeredUserId: registeredUserId })
    const chatUserId = 28
    const registeredUser = cast<RegisteredUser>({ id: registeredUserId, aggregateChatUserId: chatUserId })
    const loggedInRegisteredUserId = 2
    mockStreamerStore.closeStreamerApplication.calledWith(expectObject<CloseApplicationArgs>({ id: streamerApplicationId, message, approved: true })).mockResolvedValue(closedApplication)
    mockStreamerStore.addStreamer.calledWith(closedApplication.registeredUserId).mockResolvedValue(streamer)
    mockAccountStore.getRegisteredUsersFromIds.calledWith(expect.arrayContaining([registeredUserId])).mockResolvedValue([registeredUser])

    const result = await streamerService.approveStreamerApplication(streamerApplicationId, message, loggedInRegisteredUserId)

    expect(result).toBe(closedApplication)
    expect(single2(mockRankStore.addUserRank.mock.calls)).toEqual(expect.objectContaining({ rank: 'owner', assignee: loggedInRegisteredUserId, primaryUserId: chatUserId, streamerId: streamer.id }))
  })
})

describe(nameof(StreamerService, 'createStreamerApplication'), () => {
  test('Creates the streamer application', async () => {
    const registeredUserId = 1
    const message = 'test'
    const newApplication = cast<StreamerApplicationWithUser>({})
    mockStreamerStore.getStreamerByRegisteredUserId.calledWith(registeredUserId).mockResolvedValue(null)
    mockStreamerStore.addStreamerApplication.calledWith(expectObject<CreateApplicationArgs>({ registeredUserId, message })).mockResolvedValue(newApplication)

    const result = await streamerService.createStreamerApplication(registeredUserId, message)

    expect(result).toBe(newApplication)
  })

  test('Throws if the registered user is already a streamer', async () => {
    const registeredUserId = 1
    mockStreamerStore.getStreamerByRegisteredUserId.calledWith(registeredUserId).mockResolvedValue({ id: 1, registeredUserId })

    await expect(() => streamerService.createStreamerApplication(registeredUserId, '')).rejects.toThrowError(UserAlreadyStreamerError)
  })
})

describe(nameof(StreamerService, 'getTwitchLoginUrl'), () => {
  test('Returns a URL', () => {
    const url = streamerService.getTwitchLoginUrl()

    expect(url).toEqual(expect.stringContaining(mockStudioUrl))
    expect(url).toEqual(expect.stringContaining(mockTwitchClientId))
  })
})

describe(nameof(StreamerService, 'authoriseTwitchLogin'), () => {
  test('Sends an authorisation request and saves the provided access token to the database', async () => {
    const streamerId = 54
    const twitchUserId = 'twitchUserId'
    const twitchChannelName = 'twitchChannelName'
    const code = 'code123'
    const access_token = 'access_token123'
    const refresh_token = 'refresh_token123'

    mockStreamerChannelStore.getPrimaryChannels
      .calledWith(expectArray<number>([streamerId]))
      .mockResolvedValue([cast<PrimaryChannels>({ twitchChannel: { platformInfo: { platform: 'twitch', channel: { twitchId: twitchUserId, globalInfoHistory: [{ displayName: twitchChannelName }] }}}})])
    mockWebService.fetch
      .calledWith(expect.stringContaining(code))
      .mockResolvedValue(cast<Response>({ ok: true, json: () => Promise.resolve({ access_token, refresh_token }) }))

    await streamerService.authoriseTwitchLogin(streamerId, code)

    const [providedTwitchUserId, providedTwitchChannelName, providedToken] = single(mockAuthStore.saveTwitchAccessToken.mock.calls)
    expect(providedTwitchUserId).toBe(twitchUserId)
    expect(providedTwitchChannelName).toBe(twitchChannelName)
    expect(providedToken).toEqual(expectObject(providedToken, { accessToken: access_token, refreshToken: refresh_token }))

    const removedUserId = single2(mockTwurpleAuthProvider.removeTokenForUser.mock.calls)
    expect(removedUserId).toBe(twitchUserId)
  })

  test('Throws if the streamer does not have a primary Twitch channel', async () => {
    const streamerId = 54
    const code = 'code123'

    mockStreamerChannelStore.getPrimaryChannels
      .calledWith(expectArray<number>([streamerId]))
      .mockResolvedValue([cast<PrimaryChannels>({ twitchChannel: null })])

    await expect(() => streamerService.authoriseTwitchLogin(streamerId, code)).rejects.toThrow()

    expect(mockAuthStore.saveTwitchAccessToken.mock.calls.length).toBe(0)
    expect(mockTwurpleAuthProvider.removeTokenForUser.mock.calls.length).toBe(0)
  })
})
