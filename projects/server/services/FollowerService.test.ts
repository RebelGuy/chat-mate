import { TwitchFollower } from '@prisma/client'
import EventDispatchService, { EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER } from '@rebel/server/services/EventDispatchService'
import FollowerService from '@rebel/server/services/FollowerService'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import { Dependencies } from '@rebel/shared/context/context'
import { cast, nameof } from '@rebel/shared/testUtils'
import { single } from '@rebel/shared/util/arrays'
import { MockProxy, mock } from 'jest-mock-extended'

let mockFollowerStore: MockProxy<FollowerStore>
let mockEventDispatchService: MockProxy<EventDispatchService>
let followerService: FollowerService

beforeEach(() => {
  mockFollowerStore = mock()
  mockEventDispatchService = mock()

  followerService = new FollowerService(new Dependencies({
    followerStore: mockFollowerStore,
    eventDispatchService: mockEventDispatchService
  }))
})

describe(nameof(FollowerService, 'saveNewFollower'), () => {
  const streamerId = 5
  const twitchUserId = 'twitchUserId'
  const userName = 'userName'
  const userDisplayName = 'userDisplayName'

  test('Saves the new follower and emits an event', async () => {
    mockFollowerStore.getFollower.calledWith(streamerId, twitchUserId).mockResolvedValue(null)

    await followerService.saveNewFollower(streamerId, twitchUserId, userName, userDisplayName)

    const followerSaveData = single(mockFollowerStore.saveNewFollower.mock.calls)
    expect(followerSaveData).toEqual<typeof followerSaveData>([streamerId, twitchUserId, userName, userDisplayName])

    const eventData = single(mockEventDispatchService.addData.mock.calls)
    expect(eventData).toEqual<typeof eventData>([EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_FOLLOWER, { streamerId, userDisplayName }])
  })

  test('Does not attempt to save the follower if it already exists', async () => {
    mockFollowerStore.getFollower.calledWith(streamerId, twitchUserId).mockResolvedValue(cast<TwitchFollower>({}))

    await followerService.saveNewFollower(streamerId, twitchUserId, userName, userDisplayName)

    expect(mockFollowerStore.saveNewFollower.mock.calls.length).toBe(0)
    expect(mockEventDispatchService.addData.mock.calls.length).toBe(0)
  })
})
