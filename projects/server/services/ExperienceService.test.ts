import { Dependencies } from '@rebel/shared/context/context'
import ExperienceHelpers, { LevelData, RepetitionPenalty, SpamMult } from '@rebel/server/helpers/ExperienceHelpers'
import ExperienceService, { RankedEntry, UserLevel } from '@rebel/server/services/ExperienceService'
import ExperienceStore, { ChatExperience, ChatExperienceData, UserExperience } from '@rebel/server/stores/ExperienceStore'
import LivestreamStore, { YoutubeLivestreamParticipation } from '@rebel/server/stores/LivestreamStore'
import { cast, nameof, expectObject, expectArray } from '@rebel/shared/testUtils'
import { single } from '@rebel/shared/util/arrays'
import { anyNumber, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { asGte, asLt, asRange, GreaterThanOrEqual, NumRange } from '@rebel/shared/util/math'
import { ChatMessage, ExperienceTransaction, YoutubeLivestream } from '@prisma/client'
import { addTime } from '@rebel/shared/util/datetime'
import { ChatItem, ChatItemWithRelations } from '@rebel/server/models/chat'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import ChannelService from '@rebel/server/services/ChannelService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import AccountStore from '@rebel/server/stores/AccountStore'
import RankHelpers from '@rebel/shared/helpers/RankHelpers'
import { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import AccountService from '@rebel/server/services/AccountService'
import UserService from '@rebel/server/services/UserService'
import GenericStore, { ReplacementData } from '@rebel/server/stores/GenericStore'
import AggregateLivestreamService, { AggregateLivestreamParticipation } from '@rebel/server/services/AggregateLivestreamService'
import AggregateLivestream from '@rebel/server/models/AggregateLivestream'
import { ChatMateError } from '@rebel/shared/util/error'

let mockExperienceHelpers: MockProxy<ExperienceHelpers>
let mockExperienceStore: MockProxy<ExperienceStore>
let mockLivestreamStore: MockProxy<LivestreamStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockChatStore: MockProxy<ChatStore>
let mockChannelService: MockProxy<ChannelService>
let mockPunishmentService: MockProxy<PunishmentService>
let mockAccountStore: MockProxy<AccountStore>
let mockRankHelpers: MockProxy<RankHelpers>
let mockAccountService: MockProxy<AccountService>
let mockUserService: MockProxy<UserService>
let mockGenericStore: MockProxy<GenericStore>
let mockAggregateLivestreamService: MockProxy<AggregateLivestreamService>
let experienceService: ExperienceService

beforeEach(() => {
  mockExperienceHelpers = mock<ExperienceHelpers>()
  mockExperienceStore = mock<ExperienceStore>()
  mockLivestreamStore = mock<LivestreamStore>()
  mockChannelStore = mock<ChannelStore>()
  mockChatStore = mock<ChatStore>()
  mockChannelService = mock<ChannelService>()
  mockPunishmentService = mock<PunishmentService>()
  mockAccountStore = mock<AccountStore>()
  mockRankHelpers = mock<RankHelpers>()
  mockAccountService = mock<AccountService>()
  mockUserService = mock<UserService>()
  // @ts-ignore
  mockGenericStore = mock<GenericStore>()
  mockAggregateLivestreamService = mock<AggregateLivestreamService>()

  experienceService = new ExperienceService(new Dependencies({
    experienceHelpers: mockExperienceHelpers,
    experienceStore: mockExperienceStore,
    livestreamStore: mockLivestreamStore,
    channelStore: mockChannelStore,
    chatStore: mockChatStore,
    channelService: mockChannelService,
    punishmentService: mockPunishmentService,
    accountStore: mockAccountStore,
    rankHelpers: mockRankHelpers,
    accountService: mockAccountService,
    userService: mockUserService,
    genericStore: mockGenericStore,
    aggregateLivestreamService: mockAggregateLivestreamService
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
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(null)

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
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(data.livestream1)

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
    mockChannelStore.getPrimaryUserId.calledWith(data.author1.channelId).mockResolvedValue(userId)
    mockPunishmentService.isUserPunished.calledWith(userId, streamerId).mockResolvedValue(true)

    await experienceService.addExperienceForChat(chatItem, streamerId)

    expect(mockExperienceStore.addChatExperience.mock.calls.length).toBe(0)
  })

  test('calls ExperienceHelper calculation methods and submits result to ExperienceStore', async () => {
    const primaryUserId = 3
    const connectedUserIds = [3, 5]
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
      viewershipStreakMultiplier: 1,
      spamMultiplier: 0.8,
      repetitionPenalty: -0.2
    }
    const expectedExperienceToAdd = experienceData.baseExperience
      * (experienceData.participationStreakMultiplier * experienceData.viewershipStreakMultiplier * experienceData.spamMultiplier + experienceData.repetitionPenalty!)
      * experienceData.messageQualityMultiplier
    const msgQuality = asRange(0.2, 0, 2)
    const prevData: ChatExperience = {
      id: 1,
      user: { id: primaryUserId, aggregateChatUserId: null, linkedAt: null },
      delta: 100,
      time: data.livestream3.start!,
      experienceDataChatMessage: {
        ...experienceData,
        id: 1,
        chatMessageId: 1,
        experienceTransactionId: 1,
        spamMultiplier: 0.8,
        chatMessage: cast<ChatMessage>({ youtubeLivestreamId: data.livestream3.id })
      }
    }

    // cheating a little here since we don't want to write out all properties
    const chatItems: Partial<ChatItemWithRelations>[] = [{ userId: connectedUserIds[1] }]

    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(data.livestream3)
    mockChannelStore.getPrimaryUserId.calledWith(chatItem.author.channelId).mockResolvedValue(primaryUserId)
    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{ queriedAnyUserId: primaryUserId, connectedChatUserIds: connectedUserIds }])
    mockPunishmentService.isUserPunished.calledWith(primaryUserId, streamerId).mockResolvedValue(false)
    mockExperienceStore.getPreviousChatExperience.calledWith(streamerId, primaryUserId, null).mockResolvedValue(prevData)
    mockAggregateLivestreamService.getAggregateLivestreams.calledWith(streamerId).mockResolvedValue([
      createAggregateLivestreamParticipation(data.livestream1),
      createAggregateLivestreamParticipation(data.livestream2),
      createAggregateLivestreamParticipation(data.livestream3)
    ] as AggregateLivestream[])
    mockAggregateLivestreamService.getLivestreamParticipation.calledWith(streamerId, connectedUserIds).mockResolvedValue([
      createAggregateLivestreamParticipation(data.livestream1, true),
      createAggregateLivestreamParticipation(data.livestream2, false),
      createAggregateLivestreamParticipation(data.livestream3, true),
    ]) // -> walking participation score: 1
    mockExperienceHelpers.calculateChatMessageQuality.calledWith(chatItem.messageParts).mockReturnValue(msgQuality)
    mockExperienceHelpers.calculateParticipationMultiplier.calledWith(asGte(1, 0)).mockReturnValue(asGte(experienceData.participationStreakMultiplier, 1))
    mockExperienceHelpers.calculateQualityMultiplier.calledWith(msgQuality).mockReturnValue(asRange(experienceData.messageQualityMultiplier, 0, 2))
    mockExperienceHelpers.calculateSpamMultiplier
      .calledWith(chatItem.timestamp, prevData.time.getTime(), asRange(prevData.experienceDataChatMessage.spamMultiplier, 0.1, 1.5))
      .mockReturnValue(asRange(experienceData.spamMultiplier, 0.1, 1.5))
    mockChatStore.getChatSince.calledWith(streamerId, anyNumber()).mockResolvedValue(chatItems as ChatItemWithRelations[])
    mockExperienceHelpers.calculateRepetitionPenalty.calledWith(chatItem.timestamp, expect.arrayContaining([chatItems[0]])).mockReturnValue(asRange(experienceData.repetitionPenalty!, -2, 0))

    await experienceService.addExperienceForChat(chatItem, streamerId)

    const storeData = single(mockExperienceStore.addChatExperience.mock.calls)
    const expectedStoreData: typeof storeData = [
      streamerId, primaryUserId, chatItem.timestamp, expectedExperienceToAdd, experienceData
    ]
    expect(storeData[0]).toEqual(expectedStoreData[0])
    expect(storeData[1]).toEqual(expectedStoreData[1])
    expect(storeData[2]).toEqual(expectedStoreData[2])
    expect(storeData[3]).toBeCloseTo(expectedStoreData[3]) // floating point error!
    expect(storeData[4]).toEqual(expectedStoreData[4])
  })
})

describe(nameof(ExperienceService, 'getLeaderboard'), () => {
  test('returns ordered levels for all users', async () => {
    const streamerId = 5
    const userId1 = 1
    const userId2 = 2
    const primaryUserId1 = 1
    const primaryUserId2 = 3
    const channelName1 = 'channel 1'
    const channelName2 = 'channel 2'
    const userChannel1 = cast<UserChannel>({ defaultUserId: userId1, aggregateUserId: null, platformInfo: { platform: 'youtube', channel: { userId: userId1, globalInfoHistory: [{ name: channelName1 }] } } })
    const userChannel2 = cast<UserChannel>({ defaultUserId: userId2, aggregateUserId: primaryUserId2, platformInfo: { platform: 'twitch', channel: { userId: userId2, globalInfoHistory: [{ displayName: channelName2 }] } } })
    mockChannelService.getActiveUserChannels.calledWith(streamerId, null).mockResolvedValue([userChannel1, userChannel2])
    mockExperienceStore.getExperience.calledWith(streamerId, expect.arrayContaining([primaryUserId1, primaryUserId2]))
      .mockResolvedValue([{ primaryUserId: primaryUserId2, experience: 811 }, { primaryUserId: primaryUserId1, experience: 130 }]) // descending order
    mockExperienceHelpers.calculateLevel.mockImplementation(xp => ({ level: asGte(Math.floor(xp / 100), 0), levelProgress: asLt(0, 1) }))

    const leaderboard = await experienceService.getLeaderboard(streamerId)

    const expectedEntry1: RankedEntry = { primaryUserId: primaryUserId2, channel: userChannel2, rank: 1, level: asGte(8, 0), levelProgress: asLt(0, 1) }
    const expectedEntry2: RankedEntry = { primaryUserId: primaryUserId1, channel: userChannel1, rank: 2, level: asGte(1, 0), levelProgress: asLt(0, 1) }
    expect(leaderboard).toEqual([expectedEntry1, expectedEntry2])
  })
})

describe(nameof(ExperienceService, 'getLevels'), () => {
  test('gets experience and calculates level', async () => {
    const streamerId = 5
    const userExperiences: UserExperience[] = [{ primaryUserId: 1, experience: 0 }, { primaryUserId: 2, experience: 100 }]
    mockExperienceStore.getExperience.calledWith(streamerId, expect.arrayContaining([1, 2])).mockResolvedValue(userExperiences)

    const level0: LevelData = { level: 0, levelProgress: asLt(0, 1) }
    const level1: LevelData = { level: asGte(1, 0), levelProgress: asLt(asGte(0.5, 0), 1) }
    mockExperienceHelpers.calculateLevel.calledWith(0).mockReturnValue(level0)
    mockExperienceHelpers.calculateLevel.calledWith(asGte(100, 0)).mockReturnValue(level1)

    const result = await experienceService.getLevels(streamerId, [1, 2])

    const expectedArray: UserLevel[] = [{
      primaryUserId: 1,
      level: {
        level: 0,
        totalExperience: 0,
        levelProgress: asLt(asGte(0), 1)
      }
    }, {
      primaryUserId: 2,
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
    mockExperienceStore.getExperience.calledWith(streamerId, expect.arrayContaining([1])).mockResolvedValue([{ primaryUserId: 1, experience: -100 }])
    mockExperienceHelpers.calculateLevel.calledWith(0).mockReturnValue({ level: 0, levelProgress: asLt(0, 1) })

    const result = await experienceService.getLevels(streamerId, [1])

    const expected: UserLevel = {
      primaryUserId: 1,
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
    const primaryUserIds = [1, 2, 3]
    mockAccountService.getStreamerPrimaryUserIds.calledWith(streamerId).mockResolvedValue(primaryUserIds)
    mockExperienceStore.getAllTransactionsStartingAt.calledWith(streamerId, expectArray<number>(primaryUserIds), time + 1).mockResolvedValue([])

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
    const primaryUserId1 = 1
    const primaryUserId2 = 2

    const user1BaseXp = 100
    const user2BaseXp = 500
    const transactions: ExperienceTransaction[] = [
      { id: 1, streamerId, userId: primaryUserId1, originalUserId: null, time: time3, delta: 10 },
      { id: 2, streamerId, userId: primaryUserId1, originalUserId: null, time: time4, delta: 20 },
      { id: 3, streamerId, userId: primaryUserId2, originalUserId: null, time: time5, delta: 150 },
      { id: 4, streamerId, userId: primaryUserId2, originalUserId: null, time: time6, delta: 160 },
      { id: 5, streamerId, userId: primaryUserId2, originalUserId: null, time: time7, delta: 1 },
    ]

    mockAccountService.getStreamerPrimaryUserIds.calledWith(streamerId).mockResolvedValue([primaryUserId1, primaryUserId2])
    mockExperienceStore.getExperience.calledWith(streamerId, expect.arrayContaining([primaryUserId1, primaryUserId2]))
      .mockResolvedValue([
        { primaryUserId: primaryUserId1, experience: user1BaseXp + 10 + 20 },
        { primaryUserId: primaryUserId2, experience: user2BaseXp + 150 + 160 + 1}
      ])
    mockExperienceStore.getAllTransactionsStartingAt.calledWith(streamerId, expect.arrayContaining<number>([primaryUserId1, primaryUserId2]), time3.getTime() + 1).mockResolvedValue(transactions)
    mockExperienceHelpers.calculateLevel.mockImplementation(xp => ({ level: asGte(Math.floor(xp / 100), 0), levelProgress: asLt(0, 1) }))

    const result = await experienceService.getLevelDiffs(streamerId, time3.getTime())

    const diff = single(result)
    expect(diff.primaryUserId).toBe(primaryUserId2)
    expect(diff.timestamp).toBe(time6.getTime())
    expect(diff.startLevel).toEqual(expect.objectContaining({ level: 5, totalExperience: 500 }))
    expect(diff.endLevel).toEqual(expect.objectContaining({ level: 8, totalExperience: 811 }))
  })

  test('negative deltas are ignored', async () => {
    // if a user's level has decreased over the event period, we don't want to be notified
    const time1 = new Date()
    const time2 = addTime(time1, 'seconds', 1)
    const streamerId = 5
    const primaryUserId = 2
    const transactions: ExperienceTransaction[] = [{ id: 1, streamerId: streamerId, userId: primaryUserId, originalUserId: null, time: time1, delta: -500 }]
    mockAccountService.getStreamerPrimaryUserIds.calledWith(streamerId).mockResolvedValue([primaryUserId])
    mockExperienceStore.getExperience.calledWith(streamerId, expect.arrayContaining([primaryUserId])).mockResolvedValue([{ primaryUserId: primaryUserId, experience: -100 }])
    mockExperienceStore.getAllTransactionsStartingAt.calledWith(streamerId, expect.arrayContaining([primaryUserId]), time2.getTime() + 1).mockResolvedValue(transactions)

    const result = await experienceService.getLevelDiffs(streamerId, time2.getTime())

    expect(result.length).toBe(0)
  })
})

describe(nameof(ExperienceService, 'modifyExperience'), () => {
  test('gets the correct delta and saves rounded value to the db', async () => {
    const updatedLevel: LevelData = { level: asGte(4, 0), levelProgress: 0.1 as any }
    const primaryUserId = 1
    const streamerId = 5
    const loggedInRegisteredUserId = 10
    mockExperienceStore.getExperience.calledWith(streamerId, expect.arrayContaining([primaryUserId]))
      .mockResolvedValueOnce([{ primaryUserId: primaryUserId, experience: 150 }])
      .mockResolvedValueOnce([{ primaryUserId: primaryUserId, experience: 650 }])
    mockExperienceHelpers.calculateLevel.calledWith(asGte(150, 0)).mockReturnValue({ level: asGte(1, 0), levelProgress: 0.5 as any })
    mockExperienceHelpers.calculateLevel.calledWith(asGte(650, 0)).mockReturnValue(updatedLevel)
    mockExperienceHelpers.calculateExperience.calledWith(expect.objectContaining({ level: 5 as any, levelProgress: 5.1 - 5 as any })).mockReturnValue(asGte(650.1, 0))

    const result = await experienceService.modifyExperience(primaryUserId, streamerId, loggedInRegisteredUserId, 3.6, 'Test')

    const call = single(mockExperienceStore.addManualExperience.mock.calls)
    expect(call).toEqual<typeof call>([streamerId, primaryUserId, loggedInRegisteredUserId, 500, 'Test'])
    expect(result).toEqual<UserLevel>({ primaryUserId: primaryUserId, level: { ...updatedLevel, totalExperience: asGte(650, 0) }})
  })

  test('level does not fall below 0', async () => {
    const primaryUserId = 1
    const streamerId = 5
    const loggedInRegisteredUserId = 10
    mockExperienceStore.getExperience.calledWith(streamerId, expect.arrayContaining([primaryUserId]))
      .mockResolvedValueOnce([{ primaryUserId: primaryUserId, experience: 100 }])
      .mockResolvedValueOnce([{ primaryUserId: primaryUserId, experience: 0 }])
    mockExperienceHelpers.calculateLevel.calledWith(asGte(100, 0)).mockReturnValue({ level: asGte(1, 0), levelProgress: 0 as any })
    mockExperienceHelpers.calculateLevel.calledWith(asGte(0, 0)).mockReturnValue({ level: 0, levelProgress: 0 as any })
    mockExperienceHelpers.calculateExperience.calledWith(expect.objectContaining({ level: 0, levelProgress: 0 })).mockReturnValue(0)

    const result = await experienceService.modifyExperience(primaryUserId, streamerId, loggedInRegisteredUserId, -2, 'Test')

    const call = single(mockExperienceStore.addManualExperience.mock.calls)
    expect(call).toEqual<typeof call>([streamerId, primaryUserId, loggedInRegisteredUserId, -100, 'Test'])
    expect(result).toEqual<UserLevel>({ primaryUserId: primaryUserId, level: { level: 0, levelProgress: 0 as any, totalExperience: 0 }})
  })

  test('Throws if the user is currently busy', async () => {
    const primaryUserId = 5
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => experienceService.modifyExperience(primaryUserId, 1, 1, 1, '')).rejects.toThrowError(ChatMateError)
  })
})

describe(nameof(ExperienceService, 'recalculateChatExperience'), () => {
  // probably shouldn't have written a test for this, wtf
  test('Recalculates experience across all streamers', async () => {
    const aggregateUserId = 4
    const connectedUserIds = [4, 1, 6]
    const streamerIds = [7, 8]
    const baseExperience = 1000

    const chatMessageId1 = 125
    const chatExperience1SpamMultiplier = 1.7522
    const chatExperience1ViewershipMultiplier = 1.5
    const chatExperience1 = cast<ChatExperience>({
      id: 100,
      experienceDataChatMessage: {
        id: 1253,
        chatMessageId: chatMessageId1,
        chatMessage: { youtubeLivestreamId: 2 }, // for yt livestream 2
        baseExperience: baseExperience,
        spamMultiplier: chatExperience1SpamMultiplier,
        viewershipStreakMultiplier: chatExperience1ViewershipMultiplier
      },
      time: data.time1,
      user: { id: aggregateUserId }
    })
    const chatMessage1 = cast<ChatItemWithRelations>({ id: chatMessageId1, time: data.time1, chatMessageParts: [] })

    const chatMessageId2 = 126
    const chatExperience2SpamMultiplier = 1.835
    const chatExperience2ViewershipMultiplier = 1.6
    const chatExperience2 = cast<ChatExperience>({
      id: 101,
      experienceDataChatMessage: {
        id: 1254,
        chatMessageId: chatMessageId2,
        chatMessage: { youtubeLivestreamId: 2 }, // for yt livestream 2
        baseExperience: baseExperience,
        viewershipStreakMultiplier: chatExperience2ViewershipMultiplier
      },
      time: data.time2,
      user: { id: aggregateUserId }
    })
    const chatMessage2 = cast<ChatItemWithRelations>({ id: chatMessageId2, time: data.time2, chatMessageParts: [] })

    const chatMessageId3 = 127
    const chatExperience3ViewershipMultiplier = 1.7
    const chatExperience3 = cast<ChatExperience>({
      id: 102,
      experienceDataChatMessage: {
        id: 1255,
        chatMessageId: chatMessageId3,
        chatMessage: { youtubeLivestreamId: 4 }, // for yt livestream 4
        baseExperience: baseExperience,
        viewershipStreakMultiplier: chatExperience3ViewershipMultiplier
      },
      time: data.time3,
      user: { id: aggregateUserId }
    })
    const chatMessage3 = cast<ChatItemWithRelations>({ id: chatMessageId3, time: data.time3, chatMessageParts: [] })

    const aggregateLivestreams = [
      // these are used for both streamers for simpicity
      createAggregateLivestreamParticipation({ id: 1, liveId: '1' }),
      createAggregateLivestreamParticipation({ id: 2, liveId: '2' }),
      createAggregateLivestreamParticipation({ id: 3, liveId: '3' }),
      createAggregateLivestreamParticipation({ id: 4, liveId: '4' })
    ]
    const livestreamParticipationStreamer1: AggregateLivestreamParticipation[] = [
      createAggregateLivestreamParticipation({ id: 1, liveId: '1' }, false),
      createAggregateLivestreamParticipation({ id: 2, liveId: '2' }, true),
      createAggregateLivestreamParticipation({ id: 3, liveId: '3' }, true),
      createAggregateLivestreamParticipation({ id: 4, liveId: '4' }, true)
    ]
    const livestreamParticipationStreamer2: AggregateLivestreamParticipation[] = [
      createAggregateLivestreamParticipation({ id: 1, liveId: '1' }, true),
      createAggregateLivestreamParticipation({ id: 2, liveId: '2' }, true),
      createAggregateLivestreamParticipation({ id: 3, liveId: '3' }, false),
      createAggregateLivestreamParticipation({ id: 4, liveId: '4' }, true)
    ]
    const livestreamParticipationStreamerChat1Score = 1 // livestream 2
    const livestreamParticipationStreamerChat2Score = 1 // livestream 2
    const livestreamParticipationStreamerChat3Score = 2 // livestream 4

    const messageQuality = 2
    const repetitionPenalty = -1 as RepetitionPenalty

    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([aggregateUserId])).mockResolvedValue([{ queriedAnyUserId: aggregateUserId, connectedChatUserIds: connectedUserIds }])
    mockExperienceStore.getChatExperienceStreamerIdsForUser.calledWith(aggregateUserId).mockResolvedValue(streamerIds)
    streamerIds.forEach(sid => connectedUserIds.forEach(uid => mockPunishmentService.getPunishmentHistory.calledWith(uid, sid).mockResolvedValue([])))
    mockExperienceStore.getAllUserChatExperience.calledWith(streamerIds[0], aggregateUserId).mockResolvedValue([chatExperience1, chatExperience2])
    mockExperienceStore.getAllUserChatExperience.calledWith(streamerIds[1], aggregateUserId).mockResolvedValue([chatExperience3])
    mockChatStore.getChatSince.calledWith(streamerIds[0], 0, undefined, undefined, expectArray<number>(connectedUserIds)).mockResolvedValue([chatMessage1, chatMessage2])
    mockChatStore.getChatSince.calledWith(streamerIds[1], 0, undefined, undefined, expectArray<number>(connectedUserIds)).mockResolvedValue([chatMessage3])

    mockAggregateLivestreamService.getAggregateLivestreams.calledWith(expect.anything()).mockResolvedValue(aggregateLivestreams as AggregateLivestream[])
    mockAggregateLivestreamService.getLivestreamParticipation.calledWith(streamerIds[0], expectArray<number>(connectedUserIds)).mockResolvedValue(livestreamParticipationStreamer1)
    mockAggregateLivestreamService.getLivestreamParticipation.calledWith(streamerIds[1], expectArray<number>(connectedUserIds)).mockResolvedValue(livestreamParticipationStreamer2)
    mockExperienceHelpers.calculateParticipationMultiplier.mockImplementation(score => score + 1 as GreaterThanOrEqual<1>)

    // expect 1 as a SpamMult because chatExperience1 will have its spam multiplier overwritten
    mockExperienceHelpers.calculateSpamMultiplier.calledWith(chatExperience2.time.getTime(), chatExperience1.time.getTime(), 1 as SpamMult).mockReturnValue(chatExperience2SpamMultiplier as SpamMult)

    mockExperienceHelpers.calculateChatMessageQuality.calledWith(expect.anything()).mockReturnValue(messageQuality as NumRange<0, 2>)
    mockExperienceHelpers.calculateQualityMultiplier.calledWith(expect.anything()).mockReturnValue(1 as NumRange<0, 2>)

    mockExperienceHelpers.calculateRepetitionPenalty.calledWith(chatExperience1.time.getTime(), expect.anything()).mockReturnValue(repetitionPenalty)
    mockExperienceHelpers.calculateRepetitionPenalty.calledWith(chatExperience2.time.getTime(), expect.anything()).mockReturnValue(repetitionPenalty)
    mockExperienceHelpers.calculateRepetitionPenalty.calledWith(chatExperience3.time.getTime(), expect.anything()).mockReturnValue(repetitionPenalty)

    // act
    await experienceService.recalculateChatExperience(aggregateUserId)

    // assert
    expect(mockGenericStore.replaceMany.mock.calls.length).toBe(4)
    const [txArgsStreamer1, dataArgsStreamer1, txArgsStreamer2, dataArgsStreamer2] = mockGenericStore.replaceMany.mock.calls

    expect(txArgsStreamer1).toEqual(['experienceTransaction', expectObject<ReplacementData<'experienceTransaction'>[]>([{
      id: chatExperience1.id,
      delta: expect.any(Number)
    }, {
      id: chatExperience2.id,
      delta: expect.any(Number),
    }])])
    expect(dataArgsStreamer1).toEqual(['experienceDataChatMessage', expectObject<ReplacementData<'experienceDataChatMessage'>[]>([{
      id: chatExperience1.experienceDataChatMessage.id,
      experienceTransactionId: chatExperience1.id,
      repetitionPenalty: repetitionPenalty,
      spamMultiplier: 1, // 1 since there is no previous message
      participationStreakMultiplier: livestreamParticipationStreamerChat1Score + 1,
      viewershipStreakMultiplier: chatExperience1ViewershipMultiplier,
      messageQualityMultiplier: 1,
      baseExperience: expect.any(Number)
    }, {
      id: chatExperience2.experienceDataChatMessage.id,
      experienceTransactionId: chatExperience2.id,
      repetitionPenalty: repetitionPenalty,
      spamMultiplier: chatExperience2SpamMultiplier,
      participationStreakMultiplier: livestreamParticipationStreamerChat2Score + 1,
      viewershipStreakMultiplier: chatExperience2ViewershipMultiplier,
      messageQualityMultiplier: 1,
      baseExperience: expect.any(Number)
    }])])

    expect(txArgsStreamer2).toEqual(['experienceTransaction', expectObject<ReplacementData<'experienceTransaction'>[]>([{
      id: chatExperience3.id,
      delta: expect.any(Number)
    }])])
    expect(dataArgsStreamer2).toEqual(['experienceDataChatMessage', expectObject<ReplacementData<'experienceDataChatMessage'>[]>([{
      id: chatExperience3.experienceDataChatMessage.id,
      experienceTransactionId: chatExperience3.id,
      repetitionPenalty: repetitionPenalty,
      spamMultiplier: 1,
      participationStreakMultiplier: livestreamParticipationStreamerChat3Score + 1,
      viewershipStreakMultiplier: chatExperience3ViewershipMultiplier,
      messageQualityMultiplier: 1,
      baseExperience: expect.any(Number)
    }])])
  })

  test('Does not count experience for a chat message if a different, but connected, user was punished at the time', async () => {
    const aggregateUserId = 4
    const connectedUserIds = [4, 1]
    const streamerId = 8
    const punishment1 = cast<UserRankWithRelations>({})
    const punishment2 = cast<UserRankWithRelations>({})

    const chatExperience = cast<ChatExperience>({
      experienceDataChatMessage: {
        chatMessage: { youtubeLivestreamId: 2 }
      },
      time: data.time1,
      user: { id: aggregateUserId }
    })

    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([aggregateUserId])).mockResolvedValue([{ queriedAnyUserId: aggregateUserId, connectedChatUserIds: connectedUserIds }])
    mockExperienceStore.getChatExperienceStreamerIdsForUser.calledWith(aggregateUserId).mockResolvedValue([streamerId])
    mockPunishmentService.getPunishmentHistory.calledWith(aggregateUserId, streamerId).mockResolvedValue([punishment1])
    mockPunishmentService.getPunishmentHistory.calledWith(connectedUserIds[1], streamerId).mockResolvedValue([punishment2])
    mockExperienceStore.getAllUserChatExperience.calledWith(streamerId, aggregateUserId).mockResolvedValue([chatExperience])
    mockRankHelpers.isRankActive.calledWith(punishment1, chatExperience.time).mockReturnValue(false)
    mockRankHelpers.isRankActive.calledWith(punishment2, chatExperience.time).mockReturnValue(true)

    await experienceService.recalculateChatExperience(aggregateUserId)

    const calls = mockGenericStore.replaceMany.mock.calls
    expect(calls.length).toBe(2)
    expect(calls[0]).toEqual(['experienceTransaction', expectObject([{ delta: 0 }])])
    expect(calls[1]).toEqual(['experienceDataChatMessage', expectObject([{ baseExperience: 0 }])])
  })

  test('Does not count experience for chat experience gained off-livestream', async () => {
    const aggregateUserId = 4
    const streamerId = 8

    const chatExperience = cast<ChatExperience>({
      experienceDataChatMessage: {
        chatMessage: { youtubeLivestreamId: null }
      },
      time: data.time1,
      user: { id: aggregateUserId }
    })

    mockAccountStore.getConnectedChatUserIds.calledWith(expect.arrayContaining([aggregateUserId])).mockResolvedValue([{ queriedAnyUserId: aggregateUserId, connectedChatUserIds: [aggregateUserId] }])
    mockExperienceStore.getChatExperienceStreamerIdsForUser.calledWith(aggregateUserId).mockResolvedValue([streamerId])
    mockPunishmentService.getPunishmentHistory.calledWith(aggregateUserId, streamerId).mockResolvedValue([])
    mockExperienceStore.getAllUserChatExperience.calledWith(streamerId, aggregateUserId).mockResolvedValue([chatExperience])

    await experienceService.recalculateChatExperience(aggregateUserId)

    const calls = mockGenericStore.replaceMany.mock.calls
    expect(calls.length).toBe(2)
    expect(calls[0]).toEqual(['experienceTransaction', expectObject([{ delta: 0 }])])
    expect(calls[1]).toEqual(['experienceDataChatMessage', expectObject([{ baseExperience: 0 }])])
  })
})

function createAggregateLivestreamParticipation (youtubeLivestream: Partial<YoutubeLivestream>, hasParticipated?: boolean): AggregateLivestreamParticipation {
  return new AggregateLivestream(youtubeLivestream.start!, youtubeLivestream.end!, [youtubeLivestream as YoutubeLivestream], hasParticipated == null ? undefined : { hasParticipated })
}
