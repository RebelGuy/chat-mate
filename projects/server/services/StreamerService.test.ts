import { RegisteredUser, Streamer } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import HelixEventService from '@rebel/server/services/HelixEventService'
import StreamerService from '@rebel/server/services/StreamerService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import AccountStore from '@rebel/server/stores/AccountStore'
import RankStore, { AddUserRankArgs } from '@rebel/server/stores/RankStore'
import StreamerStore, { StreamerApplicationWithUser, CloseApplicationArgs, CreateApplicationArgs } from '@rebel/server/stores/StreamerStore'
import { single2 } from '@rebel/shared/util/arrays'
import { UserAlreadyStreamerError } from '@rebel/shared/util/error'
import { cast, expectObject, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockStreamerStore: MockProxy<StreamerStore>
let mockRankStore: MockProxy<RankStore>
let mockAccountStore: MockProxy<AccountStore>
let streamerService: StreamerService

beforeEach(() => {
  mockStreamerStore = mock()
  mockRankStore = mock()
  mockAccountStore = mock()

  streamerService = new StreamerService(new Dependencies({
    streamerStore: mockStreamerStore,
    rankStore: mockRankStore,
    accountStore: mockAccountStore
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
