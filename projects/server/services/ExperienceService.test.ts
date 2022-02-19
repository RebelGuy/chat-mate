import { Dependencies } from '@rebel/server/context/context'
import ExperienceHelpers from '@rebel/server/helpers/ExperienceHelpers'
import ExperienceService, { Level, RankedEntry } from '@rebel/server/services/ExperienceService'
import ExperienceStore, { ChatExperience, ChatExperienceData } from '@rebel/server/stores/ExperienceStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { getGetterMock, mockGetter, nameof, single } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { asGte, asLt, asRange, sum } from '@rebel/server/util/math'
import { ExperienceSnapshot, ExperienceTransaction } from '@prisma/client'
import { addTime } from '@rebel/server/util/datetime'
import { ChatItem } from '@rebel/server/models/chat'
import ChannelStore from '@rebel/server/stores/ChannelStore'

let mockExperienceHelpers: MockProxy<ExperienceHelpers>
let mockExperienceStore: MockProxy<ExperienceStore>
let mockLivestreamStore: MockProxy<LivestreamStore>
let mockViewershipStore: MockProxy<ViewershipStore>
let mockChannelStore: MockProxy<ChannelStore>
let experienceService: ExperienceService
beforeEach(() => {
  mockExperienceHelpers = mock<ExperienceHelpers>()
  mockExperienceStore = mock<ExperienceStore>()
  mockLivestreamStore = mock<LivestreamStore>()
  mockViewershipStore = mock<ViewershipStore>()
  mockChannelStore = mock<ChannelStore>()

  mockGetter(mockLivestreamStore, 'currentLivestream').mockReturnValue(data.livestream3)

  experienceService = new ExperienceService(new Dependencies({
    experienceHelpers: mockExperienceHelpers,
    experienceStore: mockExperienceStore,
    livestreamStore: mockLivestreamStore,
    viewershipStore: mockViewershipStore,
    channelStore: mockChannelStore
  }))
})

describe(nameof(ExperienceService, 'addExperienceForChat'), () => {
  test('does not add experience if livestream not live', async () => {
    const chatItem: ChatItem = {
      id: 'chat1',
      timestamp: data.time3.getTime(),
      author: data.author1,
      messageParts: [],
    }

    const livestreamGetter = getGetterMock(mockLivestreamStore, 'currentLivestream')
    livestreamGetter.mockClear()
    livestreamGetter.mockReturnValue(data.livestream1)

    await experienceService.addExperienceForChat([chatItem])

    expect(mockExperienceStore.addChatExperience.mock.calls.length).toBe(0)
  })

  test('calls ExperienceHelper calculation methods and submits result to ExperienceStore, does not notify ViewershipStore', async () => {
    const chatItem: ChatItem = {
      id: 'chat1',
      timestamp: addTime(data.livestream3.start!, 'seconds', 5).getTime(),
      author: data.author1,
      messageParts: [],
    }
    const experienceData: ChatExperienceData = {
      baseExperience: ExperienceService.CHAT_BASE_XP,
      chatMessageYtId: chatItem.id,
      messageQualityMultiplier: 1.1,
      participationStreakMultiplier: 1,
      viewershipStreakMultiplier: 1.5,
      spamMultiplier: 0.8
    }
    const expectedExperienceToAdd = experienceData.baseExperience * experienceData.messageQualityMultiplier
      * experienceData.participationStreakMultiplier * experienceData.viewershipStreakMultiplier * experienceData.spamMultiplier
    const msgQuality = asRange(0.2, 0, 2)
    const prevData: ChatExperience = {
      channel: { id: 1, youtubeId: data.channel1 },
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

    mockExperienceStore.getPreviousChatExperience.calledWith(data.channel1).mockResolvedValue(prevData)
    mockViewershipStore.getLivestreamViewership.calledWith(data.channel1).mockResolvedValue([
      { ...data.livestream1, channelId: data.channel1, viewed: true },
      { ...data.livestream2, channelId: data.channel1, viewed: false },
      { ...data.livestream2, channelId: data.channel1, viewed: false },
      { ...data.livestream2, channelId: data.channel1, viewed: true },
      { ...data.livestream3, channelId: data.channel1, viewed: true }
    ]) // -> walking viewership score: 2
    mockViewershipStore.getLivestreamParticipation.calledWith(data.channel1).mockResolvedValue([
      { ...data.livestream1, channelId: data.channel1, participated: true },
      { ...data.livestream2, channelId: data.channel1, participated: true },
      { ...data.livestream2, channelId: data.channel1, participated: false },
      { ...data.livestream2, channelId: data.channel1, participated: true },
      { ...data.livestream3, channelId: data.channel1, participated: false }
    ]) // -> walking participation score: 1
    mockExperienceHelpers.calculateChatMessageQuality.calledWith(chatItem).mockReturnValue(msgQuality)
    mockExperienceHelpers.calculateParticipationMultiplier.calledWith(asGte(1, 0)).mockReturnValue(asGte(experienceData.participationStreakMultiplier, 1))
    mockExperienceHelpers.calculateViewershipMultiplier.calledWith(asGte(2, 0)).mockReturnValue(asGte(experienceData.viewershipStreakMultiplier, 1))
    mockExperienceHelpers.calculateQualityMultiplier.calledWith(msgQuality).mockReturnValue(asRange(experienceData.messageQualityMultiplier, 0, 2))
    mockExperienceHelpers.calculateSpamMultiplier
      .calledWith(chatItem.timestamp, prevData.time.getTime(), asRange(prevData.experienceDataChatMessage.spamMultiplier, 0.1, 1.5))
      .mockReturnValue(asRange(experienceData.spamMultiplier, 0.1, 1.5))

    await experienceService.addExperienceForChat([chatItem])

    const expectedChatStoreArgs: [channelId: string, timestamp: number, xp: number, data: ChatExperienceData] = [
      chatItem.author.channelId, chatItem.timestamp, expectedExperienceToAdd, experienceData
    ]
    expect(single(mockExperienceStore.addChatExperience.mock.calls)).toEqual(expectedChatStoreArgs)
    expect(mockViewershipStore.addViewershipForChatParticipation.mock.calls.length).toEqual(0)
  })
})

describe(nameof(ExperienceService, 'getLeaderboard'), () => {
  test('returns levels for all users', async () => {
    const channelName1 = { id: 1, name: 'channel 1' }
    const channelName2 = { id: 2, name: 'channel 2' }
    mockChannelStore.getCurrentChannelNames.mockResolvedValue([channelName1, channelName2])
    mockExperienceStore.getTotalDeltaStartingAt.calledWith(channelName1.id, 0).mockResolvedValue(130)
    mockExperienceStore.getTotalDeltaStartingAt.calledWith(channelName2.id, 0).mockResolvedValue(811)
    mockExperienceHelpers.calculateLevel.mockImplementation(xp => ({ level: asGte(Math.floor(xp / 100), 0), levelProgress: asLt(0, 1) }))

    const leaderboard = await experienceService.getLeaderboard()

    const expectedEntry1: RankedEntry = { channelId: 2, channelName: 'channel 2', rank: 1, level: asGte(8, 0), levelProgress: asLt(0, 1) }
    const expectedEntry2: RankedEntry = { channelId: 1, channelName: 'channel 1', rank: 2, level: asGte(1, 0), levelProgress: asLt(0, 1) }
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
    const channelId = 1
    const experienceSnapshot: ExperienceSnapshot = {
      id: 1,
      channelId: channelId,
      experience: 100,
      time: data.time1
    }
    const expectedTotalXp = 100 + 15
    mockExperienceStore.getSnapshot.calledWith(channelId).mockResolvedValue(experienceSnapshot)
    mockExperienceStore.getTotalDeltaStartingAt.calledWith(channelId, data.time1.getTime()).mockResolvedValue(15)
    mockExperienceHelpers.calculateLevel.calledWith(asGte(expectedTotalXp, 0)).mockReturnValue({ level: asGte(2, 0), levelProgress: asLt(asGte(0.1, 0), 1) })

    const result = await experienceService.getLevel(channelId)

    expect(result).toEqual({ level: 2, levelProgress: 0.1, totalExperience: expectedTotalXp})
  })

  test('correctly handles missing snapshot', async () => {
    const channelId = 1
    mockExperienceStore.getSnapshot.calledWith(channelId).mockResolvedValue(null)
    mockExperienceStore.getTotalDeltaStartingAt.calledWith(channelId, 0).mockResolvedValue(15)
    mockExperienceHelpers.calculateLevel.calledWith(asGte(15, 0)).mockReturnValue({ level: asGte(2, 0), levelProgress: asLt(asGte(0.1, 0), 1) })

    const result = await experienceService.getLevel(channelId)

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
    const channel1Id = 1
    const channel2Id = 2
    const channel1 = { channel: { id: channel1Id }}
    const channel2 = { channel: { id: channel2Id }}

    const experienceSnapshot1: ExperienceSnapshot = { id: 1, channelId: 1, experience: 100, time: time1 }
    const experienceSnapshot2: ExperienceSnapshot = { id: 2, channelId: 2, experience: 500, time: time2 }
    
    const transactions: (ExperienceTransaction & { channel: { id: number }})[] = [
      { id: 1, channelId: 1, livestreamId: 1, time: time3, delta: 10, ...channel1 },
      { id: 2, channelId: 1, livestreamId: 1, time: time4, delta: 20, ...channel1 },
      { id: 3, channelId: 2, livestreamId: 1, time: time5, delta: 150, ...channel2 },
      { id: 4, channelId: 2, livestreamId: 1, time: time6, delta: 160, ...channel2 },
      { id: 5, channelId: 2, livestreamId: 1, time: time7, delta: 1, ...channel2 },
    ]

    mockExperienceStore.getSnapshot.calledWith(channel1Id).mockResolvedValue(experienceSnapshot1)
    mockExperienceStore.getSnapshot.calledWith(channel2Id).mockResolvedValue(experienceSnapshot2)
    mockExperienceStore.getAllTransactionsStartingAt.calledWith(time3.getTime()).mockResolvedValue(transactions)
    mockExperienceStore.getTotalDeltaStartingAt.calledWith(channel1Id, experienceSnapshot1.time.getTime()).mockResolvedValue(30)
    mockExperienceStore.getTotalDeltaStartingAt.calledWith(channel2Id, experienceSnapshot2.time.getTime()).mockResolvedValue(311)
    mockExperienceHelpers.calculateLevel.mockImplementation(xp => ({ level: asGte(Math.floor(xp / 100), 0), levelProgress: asLt(0, 1) }))

    const result = await experienceService.getLevelDiffs(time3.getTime())

    const diff = single(result)
    expect(diff.channelId).toBe(channel2.channel.id)
    expect(diff.timestamp).toBe(time6.getTime())
    expect(diff.startLevel).toEqual(expect.objectContaining({ level: 5, totalExperience: 500 }))
    expect(diff.endLevel).toEqual(expect.objectContaining({ level: 8, totalExperience: 811 }))
  })
})
