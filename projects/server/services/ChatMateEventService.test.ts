import { Dependencies } from '@rebel/shared/context/context'
import ChatMateEventService, { ChatMateEvent } from '@rebel/server/services/ChatMateEventService'
import ExperienceService, { LevelDiff } from '@rebel/server/services/ExperienceService'
import DonationStore, { DonationWithUser } from '@rebel/server/stores/DonationStore'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import { cast, expectObject, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { asGte } from '@rebel/shared/util/math'
import { TwitchFollower } from '@prisma/client'
import { filterTypes } from '@rebel/shared/util/arrays'

let mockDonationStore: MockProxy<DonationStore>
let mockExperienceService: MockProxy<ExperienceService>
let mockFollowerStore: MockProxy<FollowerStore>
let chatMateEventService: ChatMateEventService

beforeEach(() => {
  mockDonationStore = mock()
  mockExperienceService = mock()
  mockFollowerStore = mock()

  chatMateEventService = new ChatMateEventService(new Dependencies({
    donationStore: mockDonationStore,
    experienceService: mockExperienceService,
    followerStore: mockFollowerStore
  }))
})

describe(nameof(ChatMateEventService, 'getEventsSince'), () => {
  test('returns events after the given timestamp', async () => {
    const streamerId = 5
    const since = data.time1.getTime()
    const levelDiff1 = cast<LevelDiff>({ timestamp: data.time2.getTime(), primaryUserId: 1, startLevel: { level: asGte(0, 0) }, endLevel: { level: asGte(1, 0) } })
    const levelDiff2 = cast<LevelDiff>({ timestamp: data.time3.getTime(), primaryUserId: 2, startLevel: { level: asGte(2, 0) }, endLevel: { level: asGte(3, 0) } })
    const follower1 = cast<TwitchFollower>({ date: data.time2, displayName: 'test1' })
    const follower2 = cast<TwitchFollower>({ date: data.time3, displayName: 'test2' })
    const donation1 = cast<DonationWithUser>({ time: data.time2 })
    const donation2 = cast<DonationWithUser>({ time: data.time3 })

    mockExperienceService.getLevelDiffs.calledWith(streamerId, since).mockResolvedValue([levelDiff1, levelDiff2])
    mockFollowerStore.getFollowersSince.calledWith(streamerId, since).mockResolvedValue([follower1, follower2])
    mockDonationStore.getDonationsSince.calledWith(streamerId, since).mockResolvedValue([donation1, donation2])

    const result = await chatMateEventService.getEventsSince(streamerId, since)

    expect(result.length).toBe(6)
    expect(filterTypes(result, 'levelUp')[0]).toEqual(expectObject<Extract<ChatMateEvent, { type: 'levelUp' }>>({ timestamp: data.time2.getTime(), primaryUserId: 1, oldLevel: 0, newLevel: 1 }))
    expect(filterTypes(result, 'levelUp')[1]).toEqual(expectObject<Extract<ChatMateEvent, { type: 'levelUp' }>>({ timestamp: data.time3.getTime(), primaryUserId: 2, oldLevel: 2, newLevel: 3 }))
    expect(filterTypes(result, 'newTwitchFollower')[0]).toEqual(expectObject<Extract<ChatMateEvent, { type: 'newTwitchFollower' }>>({ timestamp: data.time2.getTime(), displayName: 'test1' }))
    expect(filterTypes(result, 'newTwitchFollower')[1]).toEqual(expectObject<Extract<ChatMateEvent, { type: 'newTwitchFollower' }>>({ timestamp: data.time3.getTime(), displayName: 'test2' }))
    expect(filterTypes(result, 'donation')[0]).toEqual(expectObject<Extract<ChatMateEvent, { type: 'donation' }>>({ donation: donation1 }))
    expect(filterTypes(result, 'donation')[1]).toEqual(expectObject<Extract<ChatMateEvent, { type: 'donation' }>>({ donation: donation2 }))
  })
})
