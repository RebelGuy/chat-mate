import { Dependencies } from '@rebel/shared/context/context'
import ChatMateEventService, { ChatMateEvent } from '@rebel/server/services/ChatMateEventService'
import ExperienceService, { LevelDiff } from '@rebel/server/services/ExperienceService'
import DonationStore, { DonationWithUser } from '@rebel/server/stores/DonationStore'
import FollowerStore from '@rebel/server/stores/FollowerStore'
import { cast, expectArray, expectObject, nameof } from '@rebel/shared/testUtils'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { asGte } from '@rebel/shared/util/math'
import { TwitchFollower } from '@prisma/client'
import { filterTypes, single } from '@rebel/shared/util/arrays'
import ChatStore from '@rebel/server/stores/ChatStore'
import { ChatItemWithRelations } from '@rebel/server/models/chat'

let mockDonationStore: MockProxy<DonationStore>
let mockExperienceService: MockProxy<ExperienceService>
let mockFollowerStore: MockProxy<FollowerStore>
let mockChatStore: MockProxy<ChatStore>
let chatMateEventService: ChatMateEventService

beforeEach(() => {
  mockDonationStore = mock()
  mockExperienceService = mock()
  mockFollowerStore = mock()
  mockChatStore = mock()

  chatMateEventService = new ChatMateEventService(new Dependencies({
    donationStore: mockDonationStore,
    experienceService: mockExperienceService,
    followerStore: mockFollowerStore,
    chatStore: mockChatStore
  }))
})

describe(nameof(ChatMateEventService, 'getEventsSince'), () => {
  test('returns events after the given timestamp', async () => {
    const streamerId = 5
    const userId1 = 51
    const userId2 = 52
    const since = data.time1.getTime()
    const levelDiff1 = cast<LevelDiff>({ timestamp: data.time2.getTime(), primaryUserId: 1, startLevel: { level: asGte(0, 0) }, endLevel: { level: asGte(1, 0) } })
    const levelDiff2 = cast<LevelDiff>({ timestamp: data.time3.getTime(), primaryUserId: 2, startLevel: { level: asGte(2, 0) }, endLevel: { level: asGte(3, 0) } })
    const follower1 = cast<TwitchFollower>({ date: data.time2, displayName: 'test1' })
    const follower2 = cast<TwitchFollower>({ date: data.time3, displayName: 'test2' })
    const donation1 = cast<DonationWithUser>({ time: data.time2 })
    const donation2 = cast<DonationWithUser>({ time: data.time3 })
    const chat1 = cast<ChatItemWithRelations>({ time: data.time2, user: { id: userId1 } })
    const chat2 = cast<ChatItemWithRelations>({ time: data.time4, user: { id: userId1 } }) // duplicate user
    const chat3 = cast<ChatItemWithRelations>({ time: data.time3, user: { id: 125152, aggregateChatUserId: userId2 }})
    const deletedChat = cast<ChatItemWithRelations>({ id: 15, deletedTime: data.time2 })

    mockExperienceService.getLevelDiffs.calledWith(streamerId, since).mockResolvedValue([levelDiff1, levelDiff2])
    mockFollowerStore.getFollowersSince.calledWith(streamerId, since).mockResolvedValue([follower1, follower2])
    mockDonationStore.getDonationsSince.calledWith(streamerId, since, false).mockResolvedValue([donation1, donation2])
    mockChatStore.getChatSince.calledWith(streamerId, since, undefined, undefined, undefined, undefined).mockResolvedValue([chat1, chat2, chat3]) // duplicate chat user ids should be ignored
    mockChatStore.getTimeOfFirstChat.calledWith(streamerId, expectArray<number>([userId1, userId2])).mockResolvedValue([
      { primaryUserId: userId1, firstSeen: chat1.time.getTime() }, // before the `since` time - no first message in the window we are looking
      { primaryUserId: userId2, firstSeen: data.time2.getTime() } // after the `since` time - the message above must have been the user's first message
    ])
    mockChatStore.getChatSince.calledWith(streamerId, since, undefined, undefined, undefined, true).mockResolvedValue([deletedChat])

    const result = await chatMateEventService.getEventsSince(streamerId, since)

    expect(result.length).toBe(8)
    expect(filterTypes(result, 'levelUp')[0]).toEqual(expectObject<Extract<ChatMateEvent, { type: 'levelUp' }>>({ timestamp: data.time2.getTime(), primaryUserId: 1, oldLevel: 0, newLevel: 1 }))
    expect(filterTypes(result, 'levelUp')[1]).toEqual(expectObject<Extract<ChatMateEvent, { type: 'levelUp' }>>({ timestamp: data.time3.getTime(), primaryUserId: 2, oldLevel: 2, newLevel: 3 }))
    expect(filterTypes(result, 'newTwitchFollower')[0]).toEqual(expectObject<Extract<ChatMateEvent, { type: 'newTwitchFollower' }>>({ timestamp: data.time2.getTime(), displayName: 'test1' }))
    expect(filterTypes(result, 'newTwitchFollower')[1]).toEqual(expectObject<Extract<ChatMateEvent, { type: 'newTwitchFollower' }>>({ timestamp: data.time3.getTime(), displayName: 'test2' }))
    expect(filterTypes(result, 'donation')[0]).toEqual(expectObject<Extract<ChatMateEvent, { type: 'donation' }>>({ donation: donation1 }))
    expect(filterTypes(result, 'donation')[1]).toEqual(expectObject<Extract<ChatMateEvent, { type: 'donation' }>>({ donation: donation2 }))
    expect(filterTypes(result, 'newViewer')[0]).toEqual(expectObject<Extract<ChatMateEvent, { type: 'newViewer' }>>({ primaryUserId: userId1, timestamp: data.time2.getTime() }))
    expect(single(filterTypes(result, 'chatMessageDeleted'))).toEqual(expectObject<Extract<ChatMateEvent, { type: 'chatMessageDeleted' }>>({ timestamp: data.time2.getTime(), chatMessageId: 15 }))
  })
})
