import { Streamer } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import HelixEventService from '@rebel/server/services/HelixEventService'
import StreamerService from '@rebel/server/services/StreamerService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import StreamerStore, { StreamerApplicationWithUser, CloseApplicationArgs, CreateApplicationArgs } from '@rebel/server/stores/StreamerStore'
import { UserAlreadyStreamerError } from '@rebel/server/util/error'
import { cast, expectObject, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockStreamerStore: MockProxy<StreamerStore>
let mockTwurpleService: MockProxy<TwurpleService>
let mockHelixEventService: MockProxy<HelixEventService>
let streamerService: StreamerService

beforeEach(() => {
  mockStreamerStore = mock()
  mockTwurpleService = mock()
  mockHelixEventService = mock()

  streamerService = new StreamerService(new Dependencies({
    streamerStore: mockStreamerStore,
    twurpleService: mockTwurpleService,
    helixEventService: mockHelixEventService
  }))
})

describe(nameof(StreamerService, 'approveStreamerApplication'), () => {
  test('Instructs store to approve application and adds a new streamer, then notifies Twitch services', async () => {
    const streamerApplicationId = 1
    const message = 'test'
    const closedApplication = cast<StreamerApplicationWithUser>({ registeredUserId: 2 })
    const streamer = cast<Streamer>({ id: 4 })
    mockStreamerStore.closeStreamerApplication.calledWith(expectObject<CloseApplicationArgs>({ id: streamerApplicationId, message, approved: true })).mockResolvedValue(closedApplication)
    mockStreamerStore.addStreamer.calledWith(closedApplication.registeredUserId).mockResolvedValue(streamer)

    const result = await streamerService.approveStreamerApplication(streamerApplicationId, message)

    expect(result).toBe(closedApplication)
    expect(mockTwurpleService.joinChannel).toHaveBeenCalledWith(streamer.id)
    expect(mockHelixEventService.subscribeToChannelEvents).toHaveBeenCalledWith(streamer.id)
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