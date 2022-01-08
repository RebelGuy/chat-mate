import { Dependencies } from '@rebel/server/context/context'
import ExperienceHelpers from '@rebel/server/helpers/ExperienceHelpers'
import ExperienceService, { Level } from '@rebel/server/services/ExperienceService'
import ExperienceStore, { ChatExperience, ChatExperienceData } from '@rebel/server/stores/ExperienceStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { getGetterMock, mockGetter, nameof, single } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { asGte, asLt, asRange, eps } from '@rebel/server/util/math'
import { ExperienceSnapshot, ExperienceTransaction } from '@prisma/client'
import { addTime } from '@rebel/server/util/datetime'
import { ChatItem, PartialChatMessage } from '@rebel/server/models/chat'

let mockExperienceHelpers: MockProxy<ExperienceHelpers>
let mockExperienceStore: MockProxy<ExperienceStore>
let mockLivestreamStore: MockProxy<LivestreamStore>
let mockViewershipStore: MockProxy<ViewershipStore>
let experienceService: ExperienceService
beforeEach(() => {
  mockExperienceHelpers = mock<ExperienceHelpers>()
  mockExperienceStore = mock<ExperienceStore>()
  mockLivestreamStore = mock<LivestreamStore>()
  mockViewershipStore = mock<ViewershipStore>()

  mockGetter(mockLivestreamStore, 'currentLivestream').mockReturnValue(data.livestream3)

  experienceService = new ExperienceService(new Dependencies({
    experienceHelpers: mockExperienceHelpers,
    experienceStore: mockExperienceStore,
    livestreamStore: mockLivestreamStore,
    viewershipStore: mockViewershipStore
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
      .calledWith(chatItem.timestamp, prevData.time.getTime(), asRange(prevData.experienceDataChatMessage.spamMultiplier, eps, 1))
      .mockReturnValue(asRange(experienceData.spamMultiplier, eps, 1))

    await experienceService.addExperienceForChat([chatItem])

    const expectedChatStoreArgs: [channelId: string, timestamp: number, xp: number, data: ChatExperienceData] = [
      chatItem.author.channelId, chatItem.timestamp, expectedExperienceToAdd, experienceData
    ]
    expect(single(mockExperienceStore.addChatExperience.mock.calls)).toEqual(expectedChatStoreArgs)
    expect(mockViewershipStore.addViewershipForChannel.mock.calls.length).toEqual(0)
  })
})

describe(nameof(ExperienceService, 'getLevel'), () => {
  test('returns 0 for new user', async () => {
    mockExperienceHelpers.calculateLevel.calledWith(0).mockReturnValue({ level: 0, levelProgress: asLt(asGte(0), 1) })

    const result = await experienceService.getLevel(data.channel1)

    const expected: Level = {
      level: 0,
      totalExperience: 0,
      levelProgress: asLt(asGte(0), 1)
    }
    expect(result).toEqual(expected)
  })

  test('uses results from ExperienceHelper and ExperienceStore', async () => {
    const experienceSnapshot: ExperienceSnapshot = {
      id: 1,
      channelId: 1,
      experience: 100,
      time: data.time1
    }
    const transactions: ExperienceTransaction[] = [{
      id: 1,
      channelId: 1,
      livestreamId: 1,
      time: data.time1,
      delta: 5
    }, {
      id: 2,
      channelId: 1,
      livestreamId: 1,
      time: addTime(data.time1, 'seconds', 1),
      delta: 10
    }]
    const expectedTotalXp = 100 + 5 + 10
    mockExperienceStore.getLatestSnapshot.calledWith(data.channel1).mockResolvedValue(experienceSnapshot)
    mockExperienceStore.getTransactionsStartingAt.calledWith(data.channel1, data.time1.getTime()).mockResolvedValue(transactions)
    mockExperienceHelpers.calculateLevel.calledWith(asGte(expectedTotalXp, 0)).mockReturnValue({ level: asGte(2, 0), levelProgress: asLt(asGte(0.1, 0), 1) })

    const result = await experienceService.getLevel(data.channel1)

    expect(result).toEqual({ level: 2, levelProgress: 0.1, totalExperience: expectedTotalXp})
  })
})
