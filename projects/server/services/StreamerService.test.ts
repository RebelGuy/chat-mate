import { Dependencies } from '@rebel/server/context/context'
import StreamerService from '@rebel/server/services/StreamerService'
import StreamerStore, { StreamerApplicationWithUser, CloseApplicationArgs, CreateApplicationArgs } from '@rebel/server/stores/StreamerStore'
import { UserAlreadyStreamerError } from '@rebel/server/util/error'
import { cast, expectObject, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockStreamerStore: MockProxy<StreamerStore>
let streamerService: StreamerService

beforeEach(() => {
  mockStreamerStore = mock()

  streamerService = new StreamerService(new Dependencies({
    streamerStore: mockStreamerStore
  }))
})

describe(nameof(StreamerService, 'approveStreamerApplication'), () => {
  test('Instructs store to approve application and add a new streamer', async () => {
    const streamerApplicationId = 1
    const message = 'test'
    const closedApplication = cast<StreamerApplicationWithUser>({ registeredUserId: 2 })
    mockStreamerStore.closeStreamerApplication.calledWith(expectObject<CloseApplicationArgs>({ id: streamerApplicationId, message, approved: true })).mockResolvedValue(closedApplication)

    const result = await streamerService.approveStreamerApplication(streamerApplicationId, message)

    expect(result).toBe(closedApplication)
    expect(mockStreamerStore.addStreamer).toHaveBeenCalledWith(closedApplication.registeredUserId)
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
