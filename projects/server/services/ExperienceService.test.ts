import { Dependencies } from '@rebel/server/context/context'
import ExperienceHelpers, { LevelData } from '@rebel/server/helpers/ExperienceHelpers'
import ExperienceService, { RankedEntry, UserLevel } from '@rebel/server/services/ExperienceService'
import ExperienceStore, { ChatExperience, ChatExperienceData, UserExperience } from '@rebel/server/stores/ExperienceStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { getGetterMock, cast, nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { anyNumber, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { asGte, asLt, asRange } from '@rebel/server/util/math'
import { ChatMessage, ExperienceTransaction } from '@prisma/client'
import { addTime } from '@rebel/server/util/datetime'
import { ChatItem, ChatItemWithRelations } from '@rebel/server/models/chat'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import ChannelService from '@rebel/server/services/ChannelService'
import { DeepPartial } from '@rebel/server/types'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'

let mockExperienceHelpers: MockProxy<ExperienceHelpers>
let mockExperienceStore: MockProxy<ExperienceStore>
let mockLivestreamStore: MockProxy<LivestreamStore>
let mockViewershipStore: MockProxy<ViewershipStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockChatStore: MockProxy<ChatStore>
let mockChannelService: MockProxy<ChannelService>
let mockPunishmentService: MockProxy<PunishmentService>
let experienceService: ExperienceService

beforeEach(() => {
  mockExperienceHelpers = mock<ExperienceHelpers>()
  mockExperienceStore = mock<ExperienceStore>()
  mockLivestreamStore = mock<LivestreamStore>()
  mockViewershipStore = mock<ViewershipStore>()
  mockChannelStore = mock<ChannelStore>()
  mockChatStore = mock<ChatStore>()
  mockChannelService = mock<ChannelService>()
  mockPunishmentService = mock<PunishmentService>()

  experienceService = new ExperienceService(new Dependencies({
    experienceHelpers: mockExperienceHelpers,
    experienceStore: mockExperienceStore,
    livestreamStore: mockLivestreamStore,
    viewershipStore: mockViewershipStore,
    channelStore: mockChannelStore,
    chatStore: mockChatStore,
    channelService: mockChannelService,
    punishmentService: mockPunishmentService
  }))
})

describe(nameof(ExperienceService, 'addExperienceForChat'), () => {
  test('does not add experience if no current livestream exists', async () => {
    const chatItem: ChatItem = {
      id: 'chat1',
      platform: 'youtube',
      contextToken: 'params',
      timestamp: data.time3.getTime(),
      author: data.author1,
      messageParts: [],
    }
    const streamerId = 2
    mockLivestreamStore.getActiveLivestream.calledWith(streamerId).mockResolvedValue(null)

    await experienceService.addExperienceForChat(chatItem, streamerId)

    expect(mockExperienceStore.addChatExperience.mock.calls.length).toBe(0)
  })

  test('does not add experience if livestream not live', async () => {
    const chatItem: ChatItem = {
      id: 'chat1',
      platform: 'youtube',
      contextToken: 'token',
      timestamp: data.time3.getTime(),
      author: data.author1,
      messageParts: [],
    }
    const streamerId = 2
    mockLivestreamStore.getActiveLivestream.calledWith(streamerId).mockResolvedValue(data.livestream1)

    await experienceService.addExperienceForChat(chatItem, streamerId)

    expect(mockExperienceStore.addChatExperience.mock.calls.length).toBe(0)
  })

  test('does not add experience if user is punished', async () => {
    const chatItem = cast<ChatItem>({
      platform: 'youtube',
      author: data.author1
    })
    const userId = 5
    const streamerId = 2
    mockChannelStore.getUserId.calledWith(data.author1.channelId).mockResolvedValue(userId)
    mockPunishmentService.isUserPunished.calledWith(userId, streamerId).mockResolvedValue(true)

    await experienceService.addExperienceForChat(chatItem, streamerId)

    expect(mockExperienceStore.addChatExperience.mock.calls.length).toBe(0)
  })

  test('calls ExperienceHelper calculation methods and submits result to ExperienceStore, does not notify ViewershipStore', async () => {
    const userId = 1
    const streamerId = 2
    const chatItem: ChatItem = {
      id: 'chat1',
      platform: 'youtube',
      contextToken: 'params',
      timestamp: addTime(data.livestream3.start!, 'seconds', 5).getTime(),
      author: data.author1,
      messageParts: [],
    }
    const experienceData: ChatExperienceData = {
      baseExperience: ExperienceService.CHAT_BASE_XP,
      externalId: chatItem.id,
      messageQualityMultiplier: 1.1,
      participationStreakMultiplier: 1,
      viewershipStreakMultiplier: 1.5,
      spamMultiplier: 0.8,
      repetitionPenalty: -0.2
    }
    const expectedExperienceToAdd = experienceData.baseExperience
      * (experienceData.participationStreakMultiplier * experienceData.viewershipStreakMultiplier * experienceData.spamMultiplier + experienceData.repetitionPenalty!)
      * experienceData.messageQualityMultiplier
    const msgQuality = asRange(0.2, 0, 2)
    const prevData: ChatExperience = {
      user: { id: userId },
      delta: 100,
      time: data.livestream3.start!,
      experienceDataChatMessage: {
        ...experienceData,
        id: 1,
        chatMessageId: 1,
        experienceTransactionId: 1,
        spamMultiplier: 0.8,
        chatMessage: cast<ChatMessage>({ livestreamId: data.livestream3.id })
      }
    }

    // cheating a little here since we don't want to write out all properties
    const chatItems: Partial<ChatItemWithRelations>[] = [{ userId }]

    mockLivestreamStore.getActiveLivestream.calledWith(streamerId).mockResolvedValue(data.livestream3)
    mockChannelStore.getUserId.calledWith(chatItem.author.channelId).mockResolvedValue(userId)
    mockPunishmentService.isUserPunished.calledWith(userId, streamerId).mockResolvedValue(false)
    mockExperienceStore.getPreviousChatExperience.calledWith(streamerId, userId).mockResolvedValue(prevData)
    mockViewershipStore.getLivestreamViewership.calledWith(streamerId, userId).mockResolvedValue([
      { ...data.livestream1, userId: userId, viewed: true },
      { ...data.livestream2, userId: userId, viewed: false },
      { ...data.livestream2, userId: userId, viewed: false },
      { ...data.livestream2, userId: userId, viewed: true },
      { ...data.livestream3, userId: userId, viewed: true }
    ]) // -> walking viewership score: 2
    mockViewershipStore.getLivestreamParticipation.calledWith(streamerId, userId).mockResolvedValue([
      { ...data.livestream1, userId: userId, participated: true },
      { ...data.livestream2, userId: userId, participated: true },
      { ...data.livestream2, userId: userId, participated: false },
      { ...data.livestream2, userId: userId, participated: true },
      { ...data.livestream3, userId: userId, participated: false }
    ]) // -> walking participation score: 1
    mockExperienceHelpers.calculateChatMessageQuality.calledWith(chatItem).mockReturnValue(msgQuality)
    mockExperienceHelpers.calculateParticipationMultiplier.calledWith(asGte(1, 0)).mockReturnValue(asGte(experienceData.participationStreakMultiplier, 1))
    mockExperienceHelpers.calculateViewershipMultiplier.calledWith(asGte(2, 0)).mockReturnValue(asGte(experienceData.viewershipStreakMultiplier, 1))
    mockExperienceHelpers.calculateQualityMultiplier.calledWith(msgQuality).mockReturnValue(asRange(experienceData.messageQualityMultiplier, 0, 2))
    mockExperienceHelpers.calculateSpamMultiplier
      .calledWith(chatItem.timestamp, prevData.time.getTime(), asRange(prevData.experienceDataChatMessage.spamMultiplier, 0.1, 1.5))
      .mockReturnValue(asRange(experienceData.spamMultiplier, 0.1, 1.5))
    mockChatStore.getChatSince.calledWith(streamerId, anyNumber()).mockResolvedValue(chatItems as ChatItemWithRelations[])
    mockExperienceHelpers.calculateRepetitionPenalty.calledWith(chatItem.timestamp, expect.arrayContaining([chatItems[0]])).mockReturnValue(asRange(experienceData.repetitionPenalty!, -2, 0))

    await experienceService.addExperienceForChat(chatItem, streamerId)

    const storeData = single(mockExperienceStore.addChatExperience.mock.calls)
    const expectedStoreData: typeof storeData = [
      streamerId, userId, chatItem.timestamp, expectedExperienceToAdd, experienceData
    ]
    expect(storeData[0]).toEqual(expectedStoreData[0])
    expect(storeData[1]).toEqual(expectedStoreData[1])
    expect(storeData[2]).toEqual(expectedStoreData[2])
    expect(storeData[3]).toBeCloseTo(expectedStoreData[3]) // floating point error!
    expect(storeData[4]).toEqual(expectedStoreData[4])
    expect(mockViewershipStore.addViewershipForChatParticipation.mock.calls.length).toEqual(0)
  })
})

describe(nameof(ExperienceService, 'getLeaderboard'), () => {
  test('returns ordered levels for all users', async () => {
    const streamerId = 5
    const userId1 = 1
    const userId2 = 2
    const channelName1 = 'channel 1'
    const channelName2 = 'channel 2'
    const userChannel1: DeepPartial<UserChannel> = { userId: userId1, platformInfo: { platform: 'youtube', channel: { userId: userId1, infoHistory: [{ name: channelName1 }] } } }
    const userChannel2: DeepPartial<UserChannel> = { userId: userId2, platformInfo: { platform: 'twitch', channel: { userId: userId2, infoHistory: [{ displayName: channelName2 }] } } }
    mockChannelService.getActiveUserChannels.calledWith(streamerId, 'all').mockResolvedValue([userChannel1 as UserChannel, userChannel2 as UserChannel])
    mockExperienceStore.getExperience.calledWith(streamerId, expect.arrayContaining([userId1, userId2]))
      .mockResolvedValue([{ userId: userId2, experience: 811 }, { userId: userId1, experience: 130 }]) // descending order
    mockExperienceHelpers.calculateLevel.mockImplementation(xp => ({ level: asGte(Math.floor(xp / 100), 0), levelProgress: asLt(0, 1) }))

    const leaderboard = await experienceService.getLeaderboard(streamerId)

    const expectedEntry1: RankedEntry = { userId: userId2, userName: channelName2, rank: 1, level: asGte(8, 0), levelProgress: asLt(0, 1) }
    const expectedEntry2: RankedEntry = { userId: userId1, userName: channelName1, rank: 2, level: asGte(1, 0), levelProgress: asLt(0, 1) }
    expect(leaderboard).toEqual([expectedEntry1, expectedEntry2])
  })
})

describe(nameof(ExperienceService, 'getLevels'), () => {
  test('gets experience and calculates level', async () => {
    const streamerId = 5
    const userExperiences: UserExperience[] = [{ userId: 1, experience: 0 }, { userId: 2, experience: 100 }]
    mockExperienceStore.getExperience.calledWith(streamerId, expect.arrayContaining([1, 2])).mockResolvedValue(userExperiences)

    const level0: LevelData = { level: 0, levelProgress: asLt(0, 1) }
    const level1: LevelData = { level: asGte(1, 0), levelProgress: asLt(asGte(0.5, 0), 1) }
    mockExperienceHelpers.calculateLevel.calledWith(0).mockReturnValue(level0)
    mockExperienceHelpers.calculateLevel.calledWith(asGte(100, 0)).mockReturnValue(level1)

    const result = await experienceService.getLevels(streamerId, [1, 2])

    const expectedArray: UserLevel[] = [{
      userId: 1,
      level: {
        level: 0,
        totalExperience: 0,
        levelProgress: asLt(asGte(0), 1)
      }
    }, {
      userId: 2,
      level: {
        level: asGte(1, 0),
        totalExperience: asGte(100, 0),
        levelProgress: asLt(asGte(0.5, 0), 1)
      }
    }]
    expect(result).toEqual(expect.arrayContaining(expectedArray))
  })

  test('clamps negative values', async () => {
    const streamerId = 5
    mockExperienceStore.getExperience.calledWith(streamerId, expect.arrayContaining([1])).mockResolvedValue([{ userId: 1, experience: -100 }])
    mockExperienceHelpers.calculateLevel.calledWith(0).mockReturnValue({ level: 0, levelProgress: asLt(0, 1) })

    const result = await experienceService.getLevels(streamerId, [1])

    const expected: UserLevel = {
      userId: 1,
      level: {
        level: 0,
        totalExperience: 0,
        levelProgress: asLt(asGte(0), 1)
      }
    }
    expect(single(result)).toEqual(expected)
  })
})

describe(nameof(ExperienceService, 'getLevelDiffs'), () => {
  test('returns empty array if there are no xp transactions', async () => {
    const streamerId = 5
    const time = data.time1.getTime()
    mockExperienceStore.getAllTransactionsStartingAt.calledWith(streamerId, time + 1).mockResolvedValue([])

    const result = await experienceService.getLevelDiffs(streamerId, time)

    expect(result.length).toBe(0)
  })

  test('returns correct diffs', async () => {
    const time1 = new Date()
    const time2 = addTime(time1, 'seconds', 1)
    const time3 = addTime(time1, 'seconds', 2)
    const time4 = addTime(time1, 'seconds', 3)
    const time5 = addTime(time1, 'seconds', 4)
    const time6 = addTime(time1, 'seconds', 5)
    const time7 = addTime(time1, 'seconds', 6)
    const streamerId = 5
    const userId1 = 1
    const userId2 = 2

    const user1BaseXp = 100
    const user2BaseXp = 500
    const transactions: ExperienceTransaction[] = [
      { id: 1, streamerId, userId: userId1, time: time3, delta: 10 },
      { id: 2, streamerId, userId: userId1, time: time4, delta: 20 },
      { id: 3, streamerId, userId: userId2, time: time5, delta: 150 },
      { id: 4, streamerId, userId: userId2, time: time6, delta: 160 },
      { id: 5, streamerId, userId: userId2, time: time7, delta: 1 },
    ]

    mockExperienceStore.getExperience.calledWith(streamerId, expect.arrayContaining([userId1, userId2]))
      .mockResolvedValue([
        { userId: userId1, experience: user1BaseXp + 10 + 20 },
        { userId: userId2, experience: user2BaseXp + 150 + 160 + 1}
      ])
    mockExperienceStore.getAllTransactionsStartingAt.calledWith(streamerId, time3.getTime() + 1).mockResolvedValue(transactions)
    mockExperienceHelpers.calculateLevel.mockImplementation(xp => ({ level: asGte(Math.floor(xp / 100), 0), levelProgress: asLt(0, 1) }))

    const result = await experienceService.getLevelDiffs(streamerId, time3.getTime())

    const diff = single(result)
    expect(diff.userId).toBe(userId2)
    expect(diff.timestamp).toBe(time6.getTime())
    expect(diff.startLevel).toEqual(expect.objectContaining({ level: 5, totalExperience: 500 }))
    expect(diff.endLevel).toEqual(expect.objectContaining({ level: 8, totalExperience: 811 }))
  })

  test('negative deltas are ignored', async () => {
    // if a user's level has decreased over the event period, we don't want to be notified
    const time1 = new Date()
    const time2 = addTime(time1, 'seconds', 1)
    const streamerId = 5
    const transactions: ExperienceTransaction[] = [{ id: 1, streamerId: streamerId, userId: 1, time: time1, delta: -500 }]

    mockExperienceStore.getExperience.calledWith(streamerId, expect.arrayContaining([1])).mockResolvedValue([{ userId: 1, experience: -100 }])
    mockExperienceStore.getAllTransactionsStartingAt.calledWith(streamerId, time2.getTime() + 1).mockResolvedValue(transactions)

    const result = await experienceService.getLevelDiffs(streamerId, time2.getTime())

    expect(result.length).toBe(0)
  })
})

describe(nameof(ExperienceService, 'modifyExperience'), () => {
  test('gets the correct delta and saves rounded value to the db', async () => {
    const updatedLevel: LevelData = { level: asGte(4, 0), levelProgress: 0.1 as any }
    const userId = 1
    const streamerId = 5
    const loggedInRegisteredUserId = 10
    mockExperienceStore.getExperience.calledWith(streamerId, expect.arrayContaining([userId]))
      .mockResolvedValueOnce([{ userId: userId, experience: 150 }])
      .mockResolvedValueOnce([{ userId: userId, experience: 650 }])
    mockExperienceHelpers.calculateLevel.calledWith(asGte(150, 0)).mockReturnValue({ level: asGte(1, 0), levelProgress: 0.5 as any })
    mockExperienceHelpers.calculateLevel.calledWith(asGte(650, 0)).mockReturnValue(updatedLevel)
    mockExperienceHelpers.calculateExperience.calledWith(expect.objectContaining({ level: 5 as any, levelProgress: 5.1 - 5 as any })).mockReturnValue(asGte(650.1, 0))

    const result = await experienceService.modifyExperience(userId, streamerId, loggedInRegisteredUserId, 3.6, 'Test')

    const call = single(mockExperienceStore.addManualExperience.mock.calls)
    expect(call).toEqual<typeof call>([streamerId, userId, loggedInRegisteredUserId, 500, 'Test'])
    expect(result).toEqual<UserLevel>({ userId, level: { ...updatedLevel, totalExperience: asGte(650, 0) }})
  })

  test('level does not fall below 0', async () => {
    const userId = 1
    const streamerId = 5
    const loggedInRegisteredUserId = 10
    mockExperienceStore.getExperience.calledWith(streamerId, expect.arrayContaining([userId]))
      .mockResolvedValueOnce([{ userId: userId, experience: 100 }])
      .mockResolvedValueOnce([{ userId: userId, experience: 0 }])
    mockExperienceHelpers.calculateLevel.calledWith(asGte(100, 0)).mockReturnValue({ level: asGte(1, 0), levelProgress: 0 as any })
    mockExperienceHelpers.calculateLevel.calledWith(asGte(0, 0)).mockReturnValue({ level: 0, levelProgress: 0 as any })
    mockExperienceHelpers.calculateExperience.calledWith(expect.objectContaining({ level: 0, levelProgress: 0 })).mockReturnValue(0)

    const result = await experienceService.modifyExperience(userId, streamerId, loggedInRegisteredUserId, -2, 'Test')

    const call = single(mockExperienceStore.addManualExperience.mock.calls)
    expect(call).toEqual<typeof call>([streamerId, userId, loggedInRegisteredUserId, -100, 'Test'])
    expect(result).toEqual<UserLevel>({ userId, level: { level: 0, levelProgress: 0 as any, totalExperience: 0 }})
  })
})
