import { Rank, Streamer } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import MasterchatService from '@rebel/server/services/MasterchatService'
import PunishmentService from '@rebel/server/services/rank/PunishmentService'
import ChannelStore, { UserOwnedChannels } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import { cast, nameof, expectObject, expectArray } from '@rebel/server/_test/utils'
import { single, single2 } from '@rebel/shared/util/arrays'
import { any, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { addTime } from '@rebel/shared/util/datetime'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import TwurpleService from '@rebel/server/services/TwurpleService'
import YoutubeTimeoutRefreshService from '@rebel/server/services/YoutubeTimeoutRefreshService'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs, UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { UserRankAlreadyExistsError, UserRankNotFoundError } from '@rebel/shared/util/error'
import { InternalRankResult, TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import UserService from '@rebel/server/services/UserService'

const primaryUserId = 2
const streamerId1 = 3
const streamerName1 = 'name1'
const streamerId2 = 4
const streamerName2 = 'name2'
const loggedInRegisteredUserId = 10

const banRank: Rank = { id: 1, name: 'ban', group: 'punishment', displayNameNoun: '', displayNameAdjective: '', description: null }
const timeoutRank: Rank = { id: 2, name: 'timeout', group: 'punishment', displayNameNoun: '', displayNameAdjective: '', description: null }
const muteRank: Rank = { id: 3, name: 'mute', group: 'punishment', displayNameNoun: '', displayNameAdjective: '', description: null }

const expiredTimeout: UserRankWithRelations = {
  id: 1,
  primaryUserId: primaryUserId,
  streamerId: streamerId1,
  streamerName: streamerName1,
  expirationTime: addTime(data.time1, 'seconds', 1),
  rank: timeoutRank,
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null,
  assignedByUserId: null,
  revokedByUserId: null
}
const activeTimeout: UserRankWithRelations = {
  id: 2,
  primaryUserId: primaryUserId,
  streamerId: streamerId1,
  streamerName: streamerName1,
  expirationTime: addTime(new Date(), 'hours', 1),
  rank: timeoutRank,
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null,
  assignedByUserId: null,
  revokedByUserId: null
}
const revokedBan: UserRankWithRelations = {
  id: 3,
  primaryUserId: primaryUserId,
  streamerId: streamerId1,
  streamerName: streamerName1,
  expirationTime: null,
  rank: banRank,
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: addTime(data.time1, 'seconds', 1),
  assignedByUserId: null,
  revokedByUserId: null
}
const activeBan: UserRankWithRelations = {
  id: 4,
  primaryUserId: primaryUserId,
  streamerId: streamerId1,
  streamerName: streamerName1,
  expirationTime: null,
  rank: banRank,
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null,
  assignedByUserId: null,
  revokedByUserId: null
}
const expiredMute: UserRankWithRelations = {
  id: 5,
  primaryUserId: primaryUserId,
  streamerId: streamerId1,
  streamerName: streamerName1,
  expirationTime: addTime(data.time1, 'seconds', 1),
  rank: muteRank,
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null,
  assignedByUserId: null,
  revokedByUserId: null
}
const activeMute: UserRankWithRelations = {
  id: 6,
  primaryUserId: primaryUserId,
  streamerId: streamerId1,
  streamerName: streamerName1,
  expirationTime: addTime(new Date(), 'hours', 1),
  rank: muteRank,
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null,
  assignedByUserId: null,
  revokedByUserId: null
}
const activeModRank: UserRankWithRelations = {
  id: 7,
  primaryUserId: primaryUserId,
  streamerId: streamerId1,
  streamerName: streamerName1,
  expirationTime: null,
  rank: { name: 'mod', group: 'administration' } as Rank,
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null,
  assignedByUserId: null,
  revokedByUserId: null
}

let mockMasterchatService: MockProxy<MasterchatService>
let mockRankStore: MockProxy<RankStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockChatStore: MockProxy<ChatStore>
let mockTwurpleService: MockProxy<TwurpleService>
let mockYoutubeTimeoutRefreshService: MockProxy<YoutubeTimeoutRefreshService>
let mockStreamerStore: MockProxy<StreamerStore>
let mockUserService: MockProxy<UserService>
let punishmentService: PunishmentService

beforeEach(() => {
  mockMasterchatService = mock()
  mockRankStore = mock()
  mockChannelStore = mock()
  mockChatStore = mock()
  mockTwurpleService = mock()
  mockYoutubeTimeoutRefreshService = mock()
  mockStreamerStore = mock()
  mockUserService = mock()

  punishmentService = new PunishmentService(new Dependencies({
    logService: mock(),
    masterchatService: mockMasterchatService,
    rankStore: mockRankStore,
    channelStore: mockChannelStore,
    chatStore: mockChatStore,
    twurpleService: mockTwurpleService,
    youtubeTimeoutRefreshService: mockYoutubeTimeoutRefreshService,
    streamerStore: mockStreamerStore,
    userService: mockUserService
  }))
})

describe(nameof(PunishmentService, 'initialise'), () => {
  test('sets up timeout refreshing timers', async () => {
    const timeout1: Partial<UserRankWithRelations> = {
      rank: timeoutRank,
      id: 1,
      primaryUserId: 3,
      streamerId: streamerId1,
      expirationTime: addTime(new Date(), 'seconds', 1000)
    }
    const timeout2: Partial<UserRankWithRelations> = {
      rank: timeoutRank,
      id: 2,
      primaryUserId: 4,
      streamerId: streamerId2,
      expirationTime: addTime(new Date(), 'seconds', 1000)
    }
    mockStreamerStore.getStreamers.calledWith().mockResolvedValue(cast<Streamer[]>([{ id: streamerId1 }, { id: streamerId2 }]))
    mockRankStore.getUserRanksForGroup.calledWith('punishment', streamerId1).mockResolvedValue([activeBan, timeout1] as UserRankWithRelations[])
    mockRankStore.getUserRanksForGroup.calledWith('punishment', streamerId2).mockResolvedValue([timeout2] as UserRankWithRelations[])

    const contextToken1 = 'token1'
    const contextToken2 = 'token2'
    const contextToken3 = 'token3'
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 1).mockResolvedValue({ contextToken: contextToken1 } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 2).mockResolvedValue({ contextToken: contextToken2 } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId2, 3).mockResolvedValue({ contextToken: contextToken3 } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId2, 4).mockResolvedValue(null)
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([timeout1.primaryUserId])).mockResolvedValue([{ userId: timeout1.primaryUserId!, aggregateUserId: null, youtubeChannelIds: [1, 2], twitchChannelIds: [] }])
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([timeout2.primaryUserId])).mockResolvedValue([{ userId: timeout2.primaryUserId!, aggregateUserId: null, youtubeChannelIds: [3, 4], twitchChannelIds: [] }])

    await punishmentService.initialise()

    const [args1, args2] = mockYoutubeTimeoutRefreshService.startTrackingTimeout.mock.calls
    expect(args1).toEqual([timeout1.id, timeout1.expirationTime, true, expect.any(Function)])
    expect(args2).toEqual([timeout2.id, timeout2.expirationTime, true, expect.any(Function)])

    // ensure that the youtube punishment is re-applied when required
    const onRefreshUser1 = args1[3]
    mockMasterchatService.timeout.mockClear()
    await onRefreshUser1()
    const resuppliedContextTokensUser1 = mockMasterchatService.timeout.mock.calls.map(c => single(c))
    expect(resuppliedContextTokensUser1).toEqual([contextToken1, contextToken2])

    const onRefreshUser2 = args2[3]
    mockMasterchatService.timeout.mockClear()
    await onRefreshUser2()
    const resuppliedContextTokensUser2 = mockMasterchatService.timeout.mock.calls.map(c => single(c))
    expect(resuppliedContextTokensUser2).toEqual([contextToken3])
  })
})

describe(nameof(PunishmentService, 'banUser'), () => {
  test('bans user on platforms and adds database entry', async () => {
    const contextToken1 = 'testToken1'
    const contextToken2 = 'testToken2'
    const error2 = 'error2'
    mockMasterchatService.banYoutubeChannel.calledWith(contextToken1).mockResolvedValue(true)
    mockMasterchatService.banYoutubeChannel.calledWith(contextToken2).mockRejectedValue(new Error(error2))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 1).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: contextToken1 }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 2).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: contextToken2 }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 3).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: null }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 4).mockResolvedValue(null)
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{
      userId: primaryUserId,
      aggregateUserId: null,
      youtubeChannelIds: [1, 2, 3, 4],
      twitchChannelIds: [1, 2]
    }])
    const newPunishment: any = {}
    mockRankStore.addUserRank.calledWith(expectObject<AddUserRankArgs>({ primaryUserId: primaryUserId, rank: 'ban', assignee: loggedInRegisteredUserId })).mockResolvedValue(newPunishment)

    const result = await punishmentService.banUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test')

    expect(result.rankResult.rank).toBe(newPunishment)
    expect(result.youtubeResults).toEqual<YoutubeRankResult[]>([
      { youtubeChannelId: 1, error: null },
      { youtubeChannelId: 2, error: error2 },
      { youtubeChannelId: 3, error: expect.anything() },
      { youtubeChannelId: 4, error: expect.anything() }
    ])
    expect(result.twitchResults).toEqual<TwitchRankResult[]>([
      { twitchChannelId: 1, error: null },
      { twitchChannelId: 2, error: null }
    ])

    const suppliedContextTokens = mockMasterchatService.banYoutubeChannel.mock.calls.map(c => single(c))
    expect(suppliedContextTokens).toEqual([contextToken1, contextToken2])

    const twitchCalls = mockTwurpleService.banChannel.mock.calls
    expect(twitchCalls.length).toBe(2)
    expect(twitchCalls).toEqual(expectArray<[streamerId: number, twitchChannelId: number, reason: string | null]>([
      [streamerId1, 1, expect.anything()],
      [streamerId1, 2, expect.anything()]
    ]))
  })

  test('Catches error and returns error message', async () => {
    const error = 'Test error'
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([1])).mockResolvedValue([{ userId: 1, aggregateUserId: null, twitchChannelIds: [], youtubeChannelIds: []}])
    mockRankStore.addUserRank.calledWith(expect.anything()).mockRejectedValue(new Error(error))

    const result = await punishmentService.banUser(1, streamerId1, loggedInRegisteredUserId, null)

    expect(result.rankResult).toEqual(expectObject<InternalRankResult>({ rank: null, error: error }))
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => punishmentService.banUser(primaryUserId, streamerId1, 1, '')).rejects.toThrow()
  })
})

describe(nameof(PunishmentService, 'banUserExternal'), () => {
  test('Calls Twurple/Masterchat methods to add the ban', async () => {
    const defaultUserId = 125
    const streamerId = 81
    const twitchChannel = 5
    const youtubeChannel = 2
    const userChannels: UserOwnedChannels = {
      userId: defaultUserId,
      aggregateUserId: null,
      twitchChannelIds: [twitchChannel],
      youtubeChannelIds: [youtubeChannel]
    }
    const contextToken = 'test'
    const banMessage = 'test123'

    mockChannelStore.getDefaultUserOwnedChannels.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([userChannels])
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId, youtubeChannel).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken }))
    mockMasterchatService.banYoutubeChannel.calledWith(contextToken).mockResolvedValue(true)
    mockTwurpleService.banChannel.calledWith(streamerId, twitchChannel, banMessage).mockResolvedValue()

    const result = await punishmentService.banUserExternal(defaultUserId, streamerId, banMessage)

    expect(single(result.twitchResults).error).toBeNull()
    expect(single(result.youtubeResults).error).toBeNull()
    expect(single(mockTwurpleService.banChannel.mock.calls)).toEqual([streamerId, twitchChannel, banMessage])
    expect(mockMasterchatService.banYoutubeChannel.mock.calls.length).toBe(1)
    expect(mockRankStore.addUserRank.mock.calls.length).toBe(0)
  })
})

describe(nameof(PunishmentService, 'isUserPunished'), () => {
  test('returns false if there are no active punishments for the user', async () => {
    mockRankStore.getUserRanks.calledWith(expect.arrayContaining([primaryUserId]), streamerId1)
      .mockResolvedValue([{ primaryUserId: primaryUserId, ranks: [activeModRank] }])

    const result = await punishmentService.isUserPunished(primaryUserId, streamerId1)

    expect(result).toBe(false)
  })

  test('returns true if there are active punishments for the user', async () => {
    mockRankStore.getUserRanks.calledWith(expect.arrayContaining([primaryUserId]), streamerId1)
      .mockResolvedValue([{ primaryUserId: primaryUserId, ranks: [activeModRank, activeMute] }])

    const result = await punishmentService.isUserPunished(primaryUserId, streamerId1)

    expect(result).toBe(true)
  })
})

describe(nameof(PunishmentService, 'muteUser'), () => {
  test('adds mute punishment to database', async () => {
    const newPunishment: any = {}
    mockRankStore.addUserRank
      .calledWith(expectObject<AddUserRankArgs>({ primaryUserId: primaryUserId, rank: 'mute', assignee: loggedInRegisteredUserId, expirationTime: expect.any(Date) }))
      .mockResolvedValue(newPunishment)

    const result = await punishmentService.muteUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test', 10)

    expect(result).toBe(newPunishment)
  })

  test('mute is permanent if duration is null', async () => {
    const newPunishment: any = {}
    mockRankStore.addUserRank
      .calledWith(expectObject<AddUserRankArgs>({ primaryUserId: primaryUserId, rank: 'mute', assignee: loggedInRegisteredUserId, expirationTime: null }))
      .mockResolvedValue(newPunishment)

    const result = await punishmentService.muteUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test', null)

    expect(result).toBe(newPunishment)
  })

  test('Rethrows store error', async () => {
    const error = new UserRankAlreadyExistsError()
    mockRankStore.addUserRank.calledWith(expect.anything()).mockRejectedValue(error)

    await expect(() => punishmentService.muteUser(1, streamerId1,loggedInRegisteredUserId,  null, null)).rejects.toThrowError(error)
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => punishmentService.muteUser(primaryUserId, streamerId1, 1, '', 1)).rejects.toThrow()
  })
})

describe(nameof(PunishmentService, 'timeoutUser'), () => {
  test('times out user on platforms and adds database entry', async () => {
    const contextToken1 = 'testToken1'
    const contextToken2 = 'testToken2'
    const error1 = 'error1'
    const error3 = 'error3'
    mockMasterchatService.timeout.calledWith(contextToken1).mockRejectedValue(new Error(error1))
    mockMasterchatService.timeout.calledWith(contextToken2).mockResolvedValue(true)
    mockTwurpleService.timeout.calledWith(streamerId1, 1, 'test', 1000).mockRejectedValue(new Error(error3))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 1).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: contextToken1 }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 2).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: contextToken2 }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 3).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: null }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 4).mockResolvedValue(null)
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{
      userId: primaryUserId,
      aggregateUserId: null,
      youtubeChannelIds: [1, 2, 3, 4],
      twitchChannelIds: [1, 2]
    }])

    const newPunishment: Partial<UserRankWithRelations> = {
      id: 5,
      streamerId: streamerId1,
      primaryUserId: primaryUserId,
      expirationTime: addTime(new Date(), 'seconds', 1000)
    }
    mockRankStore.addUserRank.calledWith(expectObject<AddUserRankArgs>({ streamerId: streamerId1, primaryUserId: primaryUserId, assignee: loggedInRegisteredUserId, rank: 'timeout' })).mockResolvedValue(newPunishment as UserRankWithRelations)

    const result = await punishmentService.timeoutUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test', 1000)

    expect(result.rankResult.rank).toBe(newPunishment)
    expect(result.youtubeResults).toEqual<YoutubeRankResult[]>([
      { youtubeChannelId: 1, error: error1 },
      { youtubeChannelId: 2, error: null },
      { youtubeChannelId: 3, error: expect.anything() },
      { youtubeChannelId: 4, error: expect.anything() }
    ])
    expect(result.twitchResults).toEqual<TwitchRankResult[]>([
      { twitchChannelId: 1, error: error3 },
      { twitchChannelId: 2, error: null }
    ])

    const suppliedContextTokens = mockMasterchatService.timeout.mock.calls.map(c => single(c))
    expect(suppliedContextTokens).toEqual([contextToken1, contextToken2])

    const timeoutCalls = mockTwurpleService.timeout.mock.calls
    expect(timeoutCalls).toEqual([[streamerId1, 1, any(), 1000], [streamerId1, 2, any(), 1000]])

    const youtubeTimeoutRefreshArgs = single(mockYoutubeTimeoutRefreshService.startTrackingTimeout.mock.calls)
    expect(youtubeTimeoutRefreshArgs).toEqual([newPunishment.id, newPunishment.expirationTime, false, expect.any(Function)])

    // ensure that the youtube punishment is re-applied when required
    const onRefresh = youtubeTimeoutRefreshArgs[3]
    mockMasterchatService.timeout.mockClear()
    await onRefresh()
    const resuppliedContextTokens = mockMasterchatService.timeout.mock.calls.map(c => single(c))
    expect(resuppliedContextTokens).toEqual([contextToken1, contextToken2])
  })

  test('Catches error and returns error message', async () => {
    const error = 'Test error'
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([1])).mockResolvedValue([{ userId: 1, aggregateUserId: null, twitchChannelIds: [], youtubeChannelIds: []}])
    mockRankStore.addUserRank.calledWith(expect.anything()).mockRejectedValue(new Error(error))

    const result = await punishmentService.timeoutUser(1, streamerId1, loggedInRegisteredUserId, null, 1)

    expect(result.rankResult).toEqual(expectObject<InternalRankResult>({ rank: null, error: error }))
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => punishmentService.timeoutUser(primaryUserId, streamerId1, 1, '', 1)).rejects.toThrow()
  })
})

describe(nameof(PunishmentService, 'timeoutUserExternal'), () => {
  test('Calls Twurple/Masterchat methods to add the timeout', async () => {
    const defaultUserId = 125
    const streamerId = 81
    const twitchChannel = 5
    const youtubeChannel = 2
    const userChannels: UserOwnedChannels = {
      userId: defaultUserId,
      aggregateUserId: null,
      twitchChannelIds: [twitchChannel],
      youtubeChannelIds: [youtubeChannel]
    }
    const contextToken = 'test'
    const rankId = 12
    const timeoutMessage = 'test123'
    const durationSeconds = 1000

    mockChannelStore.getDefaultUserOwnedChannels.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([userChannels])
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId, youtubeChannel).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken }))
    mockMasterchatService.timeout.calledWith(contextToken).mockResolvedValue(true)
    mockTwurpleService.timeout.calledWith(streamerId, twitchChannel, timeoutMessage, durationSeconds).mockResolvedValue()

    const result = await punishmentService.timeoutUserExternal(defaultUserId, streamerId, rankId, timeoutMessage, durationSeconds)

    expect(single(result.twitchResults).error).toBeNull()
    expect(single(result.youtubeResults).error).toBeNull()
    expect(single(mockTwurpleService.timeout.mock.calls)).toEqual([streamerId, twitchChannel, timeoutMessage, durationSeconds])
    expect(mockMasterchatService.timeout.mock.calls.length).toBe(1)
    expect(single(mockYoutubeTimeoutRefreshService.startTrackingTimeout.mock.calls)).toEqual([rankId, expect.any(Date), false, expect.any(Function)])
    expect(mockRankStore.addUserRank.mock.calls.length).toBe(0)
  })
})

describe(nameof(PunishmentService, 'getCurrentPunishments'), () => {
  test('gets punishments that are active', async () => {
    mockRankStore.getUserRanksForGroup.calledWith('punishment', streamerId1).mockResolvedValue([ activeTimeout, activeBan])

    const result = await punishmentService.getCurrentPunishments(streamerId1)

    expect(result).toEqual([activeTimeout, activeBan])
  })
})

describe(nameof(PunishmentService, 'getPunishmentHistory'), () => {
  test('gets history from store and returns', async () => {
    const history = [activeBan, activeModRank, revokedBan, expiredMute]
    mockRankStore.getUserRankHistory.calledWith(primaryUserId, streamerId1).mockResolvedValue(history)

    const result = await punishmentService.getPunishmentHistory(primaryUserId, streamerId1)

    expect(result).toEqual([activeBan, revokedBan, expiredMute])
  })
})

describe(nameof(PunishmentService, 'unbanUser'), () => {
  test('unbans user on platforms and revokes ban in database', async () => {
    const contextToken1 = 'testToken1'
    const contextToken2 = 'testToken2'
    mockMasterchatService.unbanYoutubeChannel.calledWith(contextToken1).mockResolvedValue(true)
    mockMasterchatService.unbanYoutubeChannel.calledWith(contextToken2).mockResolvedValue(true)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 1).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: contextToken1 }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 2).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: contextToken2 }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 3).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: null }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 4).mockResolvedValue(null)
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{
      userId: primaryUserId,
      aggregateUserId: null,
      youtubeChannelIds: [1, 2, 3, 4],
      twitchChannelIds: [1, 2]
    }])
    const revokedPunishment: any = {}
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ primaryUserId: primaryUserId, removedBy: loggedInRegisteredUserId, rank: 'ban' })).mockResolvedValue(revokedPunishment)

    const result = await punishmentService.unbanUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test')

    expect(result.rankResult.rank).toBe(revokedPunishment)
    expect(result.youtubeResults).toEqual<YoutubeRankResult[]>([
      { youtubeChannelId: 1, error: null },
      { youtubeChannelId: 2, error: null },
      { youtubeChannelId: 3, error: expect.anything() },
      { youtubeChannelId: 4, error: expect.anything() }
    ])
    expect(result.twitchResults).toEqual<TwitchRankResult[]>([
      { twitchChannelId: 1, error: null },
      { twitchChannelId: 2, error: null }
    ])

    const suppliedContextTokens = mockMasterchatService.unbanYoutubeChannel.mock.calls.map(c => single(c))
    expect(suppliedContextTokens).toEqual([contextToken1, contextToken2])

    const twitchCalls = mockTwurpleService.unbanChannel.mock.calls
    expect(twitchCalls).toEqual([[streamerId1, 1], [streamerId1, 2]])
  })

  test('Catches error and returns error message', async () => {
    const error = 'Test error'
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{ userId: primaryUserId, aggregateUserId: null, youtubeChannelIds: [], twitchChannelIds: [] }])
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ primaryUserId: primaryUserId, removedBy: loggedInRegisteredUserId, rank: 'ban' })).mockRejectedValue(new UserRankNotFoundError(error))

    const result = await punishmentService.unbanUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test')

    expect(result.rankResult).toEqual(expectObject<InternalRankResult>({ rank: null, error: error }))
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => punishmentService.unbanUser(primaryUserId, streamerId1, 1, '')).rejects.toThrow()
  })
})


describe(nameof(PunishmentService, 'unmuteUser'), () => {
  test('adds mute to database', async () => {
    const expectedResult: any = {}
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ primaryUserId: primaryUserId, removedBy: loggedInRegisteredUserId, rank: 'mute' })).mockResolvedValue(expectedResult)

    const result = await punishmentService.unmuteUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test')

    expect(result).toBe(expectedResult)
  })

  test('Rethrows store error', async () => {
    const error = new UserRankNotFoundError()
    mockRankStore.removeUserRank.calledWith(expect.anything()).mockRejectedValue(error)

    await expect(() => punishmentService.unmuteUser(1, streamerId1, loggedInRegisteredUserId, null)).rejects.toThrowError(error)
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => punishmentService.unmuteUser(primaryUserId, streamerId1, 1, '')).rejects.toThrow()
  })
})

describe(nameof(PunishmentService, 'untimeoutUser'), () => {
  test('untimeouts user on twitch and revokes timeout in database', async () => {
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{
      userId: primaryUserId,
      aggregateUserId: null,
      youtubeChannelIds: [1, 2, 3, 4],
      twitchChannelIds: [1, 2]
    }])
    const expectedResult = cast<UserRankWithRelations>({ id: 5 })
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ primaryUserId: primaryUserId, removedBy: loggedInRegisteredUserId, rank: 'timeout' })).mockResolvedValue(expectedResult)

    const result = await punishmentService.untimeoutUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test')

    expect(result.rankResult.rank).toBe(expectedResult)
    expect(result.youtubeResults).toEqual<YoutubeRankResult[]>([
      { youtubeChannelId: 1, error: expect.stringContaining(`YouTube timeouts expire automatically`) },
      { youtubeChannelId: 2, error: expect.stringContaining(`YouTube timeouts expire automatically`) },
      { youtubeChannelId: 3, error: expect.anything() },
      { youtubeChannelId: 4, error: expect.anything() }
    ])
    expect(result.twitchResults).toEqual<TwitchRankResult[]>([
      { twitchChannelId: 1, error: null },
      { twitchChannelId: 2, error: null }
    ])

    expect(mockMasterchatService.timeout.mock.calls.length).toBe(0)

    const twitchCalls = mockTwurpleService.untimeout.mock.calls
    expect(twitchCalls).toEqual([[streamerId1, 1, any()], [streamerId1, 2, any()]])

    const stopTrackingArgs = single(mockYoutubeTimeoutRefreshService.stopTrackingTimeout.mock.calls)
    expect(stopTrackingArgs[0]).toBe(expectedResult.id)
  })

  test('Catches error and returns error message', async () => {
    const error = 'Test error'
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{ userId: primaryUserId, aggregateUserId: null, youtubeChannelIds: [], twitchChannelIds: [] }])
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ primaryUserId: primaryUserId, removedBy: loggedInRegisteredUserId, rank: 'timeout' })).mockRejectedValue(new UserRankNotFoundError(error))

    const result = await punishmentService.untimeoutUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test')

    expect(result.rankResult).toEqual(expectObject<InternalRankResult>({ rank: null, error: error }))
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => punishmentService.untimeoutUser(primaryUserId, streamerId1, 1, '')).rejects.toThrow()
  })
})

describe(nameof(PunishmentService, 'untimeoutUserExternal'), () => {
  test('Calls Twurple method to remove the timeout', async () => {
    const defaultUserId = 125
    const streamerId = 81
    const twitchChannel = 5
    const youtubeChannel = 2
    const userChannels: UserOwnedChannels = {
      userId: defaultUserId,
      aggregateUserId: null,
      twitchChannelIds: [twitchChannel],
      youtubeChannelIds: [youtubeChannel]
    }
    const rankId = 581
    const revokeMessage = 'test123'

    mockChannelStore.getDefaultUserOwnedChannels.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([userChannels])
    mockTwurpleService.untimeout.calledWith(streamerId, twitchChannel, revokeMessage).mockResolvedValue()

    const result = await punishmentService.untimeoutUserExternal(defaultUserId, streamerId, rankId, revokeMessage)

    expect(single2(mockYoutubeTimeoutRefreshService.stopTrackingTimeout.mock.calls)).toBe(rankId)
    expect(single(result.twitchResults).error).toBeNull()
    expect(single(result.youtubeResults).error).not.toBeNull()
    expect(mockTwurpleService.untimeout.mock.calls.length).toBe(1)
    expect(mockRankStore.removeUserRank.mock.calls.length).toBe(0)
  })
})
