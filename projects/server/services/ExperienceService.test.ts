import { Dependencies } from '@rebel/server/context/context'
import ExperienceHelpers, { LevelData } from '@rebel/server/helpers/ExperienceHelpers'
import ExperienceService, { Level, RankedEntry } from '@rebel/server/services/ExperienceService'
import ExperienceStore, { ChatExperience, ChatExperienceData } from '@rebel/server/stores/ExperienceStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { getGetterMock, mockGetter, nameof, single } from '@rebel/server/_test/utils'
import { anyNumber, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { asGte, asLt, asRange, sum } from '@rebel/server/util/math'
import { ExperienceSnapshot, ExperienceTransaction } from '@prisma/client'
import { addTime } from '@rebel/server/util/datetime'
import { ChatItem, ChatItemWithRelations } from '@rebel/server/models/chat'
import ChannelStore, { UserChannel, UserNames } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import ChannelService from '@rebel/server/services/ChannelService'
import { DeepPartial } from '@rebel/server/types'

let mockExperienceHelpers: MockProxy<ExperienceHelpers>
let mockExperienceStore: MockProxy<ExperienceStore>
let mockLivestreamStore: MockProxy<LivestreamStore>
let mockViewershipStore: MockProxy<ViewershipStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockChatStore: MockProxy<ChatStore>
let mockChannelService: MockProxy<ChannelService>
let experienceService: ExperienceService
beforeEach(() => {
  mockExperienceHelpers = mock<ExperienceHelpers>()
  mockExperienceStore = mock<ExperienceStore>()
  mockLivestreamStore = mock<LivestreamStore>()
  mockViewershipStore = mock<ViewershipStore>()
  mockChannelStore = mock<ChannelStore>()
  mockChatStore = mock<ChatStore>()
  mockChannelService = mock<ChannelService>()

  mockGetter(mockLivestreamStore, 'currentLivestream').mockReturnValue(data.livestream3)

  experienceService = new ExperienceService(new Dependencies({
    experienceHelpers: mockExperienceHelpers,
    experienceStore: mockExperienceStore,
    livestreamStore: mockLivestreamStore,
    viewershipStore: mockViewershipStore,
    channelStore: mockChannelStore,
    chatStore: mockChatStore,
    channelService: mockChannelService
  }))
})

describe(nameof(ExperienceService, 'addExperienceForChat'), () => {
  test('does not add experience if livestream not live', async () => {
    const chatItem: ChatItem = {
      id: 'chat1',
      platform: 'youtube',
      timestamp: data.time3.getTime(),
      author: data.author1,
      messageParts: [],
    }

    const livestreamGetter = getGetterMock(mockLivestreamStore, 'currentLivestream')
    livestreamGetter.mockClear()
    livestreamGetter.mockReturnValue(data.livestream1)

    await experienceService.addExperienceForChat(chatItem)

    expect(mockExperienceStore.addChatExperience.mock.calls.length).toBe(0)
  })

  test('calls ExperienceHelper calculation methods and submits result to ExperienceStore, does not notify ViewershipStore', async () => {
    const userId = 1
    const chatItem: ChatItem = {
      id: 'chat1',
      platform: 'youtube',
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
      livestream: data.livestream3,
      experienceDataChatMessage: {
        ...experienceData,
        id: 1,
        chatMessageId: 1,
        experienceTransactionId: 1,
        spamMultiplier: 0.8,
        chatMessage: null!
      }
    }

    // cheating a little here since we don't want to write out all properties
    const chatItems: Partial<ChatItemWithRelations>[] = [{ userId }]

    mockChannelStore.getUserId.calledWith(chatItem.author.channelId).mockResolvedValue(userId)
    mockExperienceStore.getPreviousChatExperience.calledWith(userId).mockResolvedValue(prevData)
    mockViewershipStore.getLivestreamViewership.calledWith(userId).mockResolvedValue([
      { ...data.livestream1, userId: userId, viewed: true },
      { ...data.livestream2, userId: userId, viewed: false },
      { ...data.livestream2, userId: userId, viewed: false },
      { ...data.livestream2, userId: userId, viewed: true },
      { ...data.livestream3, userId: userId, viewed: true }
    ]) // -> walking viewership score: 2
    mockViewershipStore.getLivestreamParticipation.calledWith(userId).mockResolvedValue([
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
    mockChatStore.getChatSince.calledWith(anyNumber()).mockResolvedValue(chatItems as ChatItemWithRelations[])
    mockExperienceHelpers.calculateRepetitionPenalty.calledWith(chatItem.timestamp, expect.arrayContaining([chatItems[0]])).mockReturnValue(asRange(experienceData.repetitionPenalty!, -2, 0))

    await experienceService.addExperienceForChat(chatItem)

    const expectedStoreData: [userId: number, timestamp: number, xp: number, data: ChatExperienceData] = [
      userId, chatItem.timestamp, expectedExperienceToAdd, experienceData
    ]
    const storeData = single(mockExperienceStore.addChatExperience.mock.calls)
    expect(storeData[0]).toEqual(expectedStoreData[0])
    expect(storeData[1]).toEqual(expectedStoreData[1])
    expect(storeData[2]).toBeCloseTo(expectedStoreData[2]) // floating point error!
    expect(storeData[3]).toEqual(expectedStoreData[3])
    expect(mockViewershipStore.addViewershipForChatParticipation.mock.calls.length).toEqual(0)
  })
})

describe(nameof(ExperienceService, 'getLeaderboard'), () => {
  test('returns levels for all users', async () => {
    const userId1 = 1
    const userId2 = 2
    const channelName1 = 'channel 1'
    const channelName2 = 'channel 2'
    const userChannel1: DeepPartial<UserChannel> = { platform: 'youtube', channel: { userId: userId1, infoHistory: [{ name: channelName1 }] } }
    const userChannel2: DeepPartial<UserChannel> = { platform: 'twitch', channel: { userId: userId2, infoHistory: [{ displayName: channelName2 }] } }
    mockChannelService.getActiveUserChannels.mockResolvedValue([userChannel1 as UserChannel, userChannel2 as UserChannel])
    mockExperienceStore.getTotalDeltaStartingAt.calledWith(userId1, 0).mockResolvedValue(130)
    mockExperienceStore.getTotalDeltaStartingAt.calledWith(userId2, 0).mockResolvedValue(811)
    mockExperienceHelpers.calculateLevel.mockImplementation(xp => ({ level: asGte(Math.floor(xp / 100), 0), levelProgress: asLt(0, 1) }))

    const leaderboard = await experienceService.getLeaderboard()

    const expectedEntry1: RankedEntry = { userId: userId2, userName: channelName2, rank: 1, level: asGte(8, 0), levelProgress: asLt(0, 1) }
    const expectedEntry2: RankedEntry = { userId: userId1, userName: channelName1, rank: 2, level: asGte(1, 0), levelProgress: asLt(0, 1) }
    expect(leaderboard).toEqual([expectedEntry1, expectedEntry2])
  })
})

describe(nameof(ExperienceService, 'getLevel'), () => {
  test('returns 0 for new user', async () => {
    mockExperienceHelpers.calculateLevel.calledWith(0).mockReturnValue({ level: 0, levelProgress: asLt(asGte(0), 1) })

    const result = await experienceService.getLevel(1)

    const expected: Level = {
      level: 0,
      totalExperience: 0,
      levelProgress: asLt(asGte(0), 1)
    }
    expect(result).toEqual(expected)
  })

  test('uses results from ExperienceHelper and ExperienceStore', async () => {
    const userId = 1
    const experienceSnapshot: ExperienceSnapshot = {
      id: 1,
      userId: userId,
      experience: 100,
      time: data.time1
    }
    const expectedTotalXp = 100 + 15
    mockExperienceStore.getSnapshot.calledWith(userId).mockResolvedValue(experienceSnapshot)
    mockExperienceStore.getTotalDeltaStartingAt.calledWith(userId, data.time1.getTime()).mockResolvedValue(15)
    mockExperienceHelpers.calculateLevel.calledWith(asGte(expectedTotalXp, 0)).mockReturnValue({ level: asGte(2, 0), levelProgress: asLt(asGte(0.1, 0), 1) })

    const result = await experienceService.getLevel(userId)

    expect(result).toEqual({ level: 2, levelProgress: 0.1, totalExperience: expectedTotalXp})
  })

  test('correctly handles missing snapshot', async () => {
    const userId = 1
    mockExperienceStore.getSnapshot.calledWith(userId).mockResolvedValue(null)
    mockExperienceStore.getTotalDeltaStartingAt.calledWith(userId, 0).mockResolvedValue(15)
    mockExperienceHelpers.calculateLevel.calledWith(asGte(15, 0)).mockReturnValue({ level: asGte(2, 0), levelProgress: asLt(asGte(0.1, 0), 1) })

    const result = await experienceService.getLevel(userId)

    expect(result).toEqual({ level: 2, levelProgress: 0.1, totalExperience: 15})
  })
})

describe(nameof(ExperienceService, 'getLevelDiffs'), () => {
  test('returns empty array if there are no xp transactions', async () => {
    const time = data.time1.getTime()
    mockExperienceStore.getAllTransactionsStartingAt.calledWith(time).mockResolvedValue([])

    const result = await experienceService.getLevelDiffs(time)

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
    const userId1 = 1
    const userId2 = 2

    const experienceSnapshot1: ExperienceSnapshot = { id: 1, userId: userId1, experience: 100, time: time1 }
    const experienceSnapshot2: ExperienceSnapshot = { id: 2, userId: userId2, experience: 500, time: time2 }
    
    const transactions: ExperienceTransaction[] = [
      { id: 1, userId: userId1, livestreamId: 1, time: time3, delta: 10 },
      { id: 2, userId: userId1, livestreamId: 1, time: time4, delta: 20 },
      { id: 3, userId: userId2, livestreamId: 1, time: time5, delta: 150 },
      { id: 4, userId: userId2, livestreamId: 1, time: time6, delta: 160 },
      { id: 5, userId: userId2, livestreamId: 1, time: time7, delta: 1 },
    ]

    mockExperienceStore.getSnapshot.calledWith(userId1).mockResolvedValue(experienceSnapshot1)
    mockExperienceStore.getSnapshot.calledWith(userId2).mockResolvedValue(experienceSnapshot2)
    mockExperienceStore.getAllTransactionsStartingAt.calledWith(time3.getTime()).mockResolvedValue(transactions)
    mockExperienceStore.getTotalDeltaStartingAt.calledWith(userId1, experienceSnapshot1.time.getTime()).mockResolvedValue(30)
    mockExperienceStore.getTotalDeltaStartingAt.calledWith(userId2, experienceSnapshot2.time.getTime()).mockResolvedValue(311)
    mockExperienceHelpers.calculateLevel.mockImplementation(xp => ({ level: asGte(Math.floor(xp / 100), 0), levelProgress: asLt(0, 1) }))

    const result = await experienceService.getLevelDiffs(time3.getTime())

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
    const transactions: ExperienceTransaction[] = [{ id: 1, userId: 1, livestreamId: 1, time: time1, delta: -500 }]

    mockExperienceStore.getSnapshot.mockResolvedValue(null)
    mockExperienceStore.getTotalDeltaStartingAt.mockResolvedValue(-100)
    mockExperienceStore.getAllTransactionsStartingAt.mockResolvedValue(transactions)

    const result = await experienceService.getLevelDiffs(time2.getTime())

    expect(result.length).toBe(0)
  })
})

describe(nameof(ExperienceService, 'modifyExperience'), () => {
  test('gets the correct delta and saves rounded value to the db', async () => {
    const time1 = new Date()
    const updatedLevel: LevelData = { level: asGte(4, 0), levelProgress: 0.1 as any }
    const userId = 1
    mockExperienceStore.getSnapshot.calledWith(userId).mockResolvedValue({ id: 1, userId: userId, experience: 100, time: time1 })
    mockExperienceStore.getTotalDeltaStartingAt.calledWith(userId, time1.getTime()).mockResolvedValueOnce(50).mockResolvedValueOnce(550)
    mockExperienceHelpers.calculateLevel.calledWith(asGte(150, 0)).mockReturnValue({ level: asGte(1, 0), levelProgress: 0.5 as any })
    mockExperienceHelpers.calculateLevel.calledWith(asGte(650, 0)).mockReturnValue(updatedLevel)
    mockExperienceHelpers.calculateExperience.calledWith(expect.objectContaining({ level: 5 as any, levelProgress: 5.1 - 5 as any })).mockReturnValue(asGte(650.1, 0))

    const result = await experienceService.modifyExperience(userId, 3.6, 'Test')

    const call = single(mockExperienceStore.addManualExperience.mock.calls)
    expect(call).toEqual<typeof call>([userId, 500, 'Test'])
    expect(result).toEqual<Level>({ ...updatedLevel, totalExperience: asGte(650, 0) })
  })

  test('level does not fall below 0', async () => {
    const time1 = new Date()
    const userId = 1
    mockExperienceStore.getSnapshot.calledWith(userId).mockResolvedValue({ id: 1, userId: userId, experience: 0, time: time1 })
    mockExperienceStore.getTotalDeltaStartingAt.calledWith(userId, time1.getTime()).mockResolvedValueOnce(100).mockResolvedValueOnce(0)
    mockExperienceHelpers.calculateLevel.calledWith(asGte(100, 0)).mockReturnValue({ level: asGte(1, 0), levelProgress: 0 as any })
    mockExperienceHelpers.calculateLevel.calledWith(asGte(0, 0)).mockReturnValue({ level: 0, levelProgress: 0 as any })
    mockExperienceHelpers.calculateExperience.calledWith(expect.objectContaining({ level: 0, levelProgress: 0 })).mockReturnValue(0)

    const result = await experienceService.modifyExperience(userId, -2, 'Test')

    const call = single(mockExperienceStore.addManualExperience.mock.calls)
    expect(call).toEqual<typeof call>([userId, -100, 'Test'])
    expect(result).toEqual<Level>({ level: 0, levelProgress: 0 as any, totalExperience: 0 })

  })
})
