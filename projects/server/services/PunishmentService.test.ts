import { Punishment, Rank } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import PunishmentService, { TwitchPunishmentResult, YoutubePunishmentResult } from '@rebel/server/services/PunishmentService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import PunishmentStore, { CreatePunishmentArgs } from '@rebel/server/stores/PunishmentStore'
import { nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { any, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { addTime } from '@rebel/server/util/datetime'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import TwurpleService from '@rebel/server/services/TwurpleService'
import YoutubeTimeoutRefreshService from '@rebel/server/services/YoutubeTimeoutRefreshService'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs, UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { NotFoundError } from 'typescript-rest/dist/server-errors'
import { UserRankNotFoundError } from '@rebel/server/util/error'

const userId1 = 2

const banRank: Rank = { id: 1, name: 'ban', group: 'punishment', displayNameNoun: '', displayNameAdjective: '', description: null }
const timeoutRank: Rank = { id: 2, name: 'timeout', group: 'punishment', displayNameNoun: '', displayNameAdjective: '', description: null }
const muteRank: Rank = { id: 3, name: 'mute', group: 'punishment', displayNameNoun: '', displayNameAdjective: '', description: null }

const expiredTimeout: UserRankWithRelations = {
  id: 1,
  userId: userId1,
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
  userId: userId1,
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
  userId: userId1,
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
  userId: userId1,
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
  userId: userId1,
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
  userId: userId1,
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
  userId: userId1,
  expirationTime: null,
  rank: { name: 'mod', group: 'administration' } as Rank,
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null,
  assignedByUserId: null,
  revokedByUserId: null
}

let mockMasterchatProxyService: MockProxy<MasterchatProxyService>
let mockRankStore: MockProxy<RankStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockChatStore: MockProxy<ChatStore>
let mockTwurpleService: MockProxy<TwurpleService>
let mockYoutubeTimeoutRefreshService: MockProxy<YoutubeTimeoutRefreshService>
let punishmentService: PunishmentService

beforeEach(() => {
  mockMasterchatProxyService = mock()
  mockRankStore = mock()
  mockChannelStore = mock()
  mockChatStore = mock()
  mockTwurpleService = mock()
  mockYoutubeTimeoutRefreshService = mock()

  punishmentService = new PunishmentService(new Dependencies({
    logService: mock(),
    masterchatProxyService: mockMasterchatProxyService,
    rankStore: mockRankStore,
    channelStore: mockChannelStore,
    chatStore: mockChatStore,
    twurpleService: mockTwurpleService,
    youtubeTimeoutRefreshService: mockYoutubeTimeoutRefreshService
  }))
})

describe(nameof(PunishmentService, 'initialise'), () => {
  test('sets up timeout refreshing timers', async () => {
    const timeout1: Partial<UserRankWithRelations> = {
      rank: timeoutRank,
      id: 1,
      userId: 3,
      expirationTime: addTime(new Date(), 'seconds', 1000)
    }
    const timeout2: Partial<UserRankWithRelations> = {
      rank: timeoutRank,
      id: 2,
      userId: 4,
      expirationTime: addTime(new Date(), 'seconds', 1000)
    }
    const currentPunishments: Partial<UserRankWithRelations>[] = [activeBan, timeout1, timeout2]
    mockRankStore.getUserRanksForGroup.mockResolvedValue(currentPunishments as UserRankWithRelations[])

    const contextToken1 = 'token1'
    const contextToken2 = 'token2'
    const contextToken3 = 'token3'
    mockChatStore.getLastChatByYoutubeChannel.calledWith(1).mockResolvedValue({ contextToken: contextToken1 } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(2).mockResolvedValue({ contextToken: contextToken2 } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(3).mockResolvedValue({ contextToken: contextToken3 } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(4).mockResolvedValue(null)
    mockChannelStore.getUserOwnedChannels.calledWith(timeout1.userId!).mockResolvedValue({ userId: timeout1.userId!, youtubeChannels: [1, 2], twitchChannels: [] })
    mockChannelStore.getUserOwnedChannels.calledWith(timeout2.userId!).mockResolvedValue({ userId: timeout2.userId!, youtubeChannels: [3, 4], twitchChannels: [] })

    await punishmentService.initialise()

    const [args1, args2] = mockYoutubeTimeoutRefreshService.startTrackingTimeout.mock.calls
    expect(args1).toEqual([timeout1.id, timeout1.expirationTime, true, expect.any(Function)])
    expect(args2).toEqual([timeout2.id, timeout2.expirationTime, true, expect.any(Function)])

    // ensure that the youtube punishment is re-applied when required
    const onRefreshUser1 = args1[3]
    mockMasterchatProxyService.timeout.mockClear()
    await onRefreshUser1()
    const resuppliedContextTokensUser1 = mockMasterchatProxyService.timeout.mock.calls.map(c => single(c))
    expect(resuppliedContextTokensUser1).toEqual([contextToken1, contextToken2])

    const onRefreshUser2 = args2[3]
    mockMasterchatProxyService.timeout.mockClear()
    await onRefreshUser2()
    const resuppliedContextTokensUser2 = mockMasterchatProxyService.timeout.mock.calls.map(c => single(c))
    expect(resuppliedContextTokensUser2).toEqual([contextToken3])
  })
})

describe(nameof(PunishmentService, 'banUser'), () => {
  test('bans user on platforms and adds database entry', async () => {
    const contextToken1 = 'testToken1'
    const contextToken2 = 'testToken2'
    const error2 = 'error2'
    mockMasterchatProxyService.banYoutubeChannel.calledWith(contextToken1).mockResolvedValue(true)
    mockMasterchatProxyService.banYoutubeChannel.calledWith(contextToken2).mockRejectedValue(new Error(error2))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(1).mockResolvedValue({ contextToken: contextToken1 } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(2).mockResolvedValue({ contextToken: contextToken2 } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(3).mockResolvedValue({ contextToken: null } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(4).mockResolvedValue(null)
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({
      userId: userId1,
      youtubeChannels: [1, 2, 3, 4],
      twitchChannels: [1, 2]
    })
    mockRankStore.removeUserRank.calledWith(expect.objectContaining<Partial<RemoveUserRankArgs>>({ rank: 'ban' })).mockRejectedValue(new UserRankNotFoundError())
    const newPunishment: any = {}
    mockRankStore.addUserRank.calledWith(expect.objectContaining<Partial<AddUserRankArgs>>({ userId: userId1, rank: 'ban' })).mockResolvedValue(newPunishment)

    const result = await punishmentService.banUser(userId1, 'test')

    expect(mockRankStore.removeUserRank).toHaveBeenCalled()
    expect(result.punishment).toBe(newPunishment)
    expect(result.youtubeResults).toEqual<YoutubePunishmentResult[]>([
      { youtubeChannelId: 1, error: null },
      { youtubeChannelId: 2, error: error2 },
      { youtubeChannelId: 3, error: expect.anything() },
      { youtubeChannelId: 4, error: expect.anything() }
    ])
    expect(result.twitchResults).toEqual<TwitchPunishmentResult[]>([
      { twitchChannelId: 1, error: null },
      { twitchChannelId: 2, error: null }
    ])

    const suppliedContextTokens = mockMasterchatProxyService.banYoutubeChannel.mock.calls.map(c => single(c))
    expect(suppliedContextTokens).toEqual([contextToken1, contextToken2])
    
    const suppliedTwitchChannelIds = mockTwurpleService.banChannel.mock.calls.map(c => c[0])
    expect(suppliedTwitchChannelIds).toEqual([1, 2])
  })
})

describe(nameof(PunishmentService, 'isUserPunished'), () => {
  test('returns false if there are no active punishments for the user', async () => {
    mockRankStore.getUserRanks.calledWith(expect.arrayContaining([userId1]))
      .mockResolvedValue([{ userId: userId1, ranks: [activeModRank] }])
  
    const result = await punishmentService.isUserPunished(userId1)

    expect(result).toBe(false)
  })

  test('returns true if there are active punishments for the user', async () => {
    mockRankStore.getUserRanks.calledWith(expect.arrayContaining([userId1]))
      .mockResolvedValue([{ userId: userId1, ranks: [activeModRank, activeMute] }])
  
    const result = await punishmentService.isUserPunished(userId1)

    expect(result).toBe(true)
  })
})

describe(nameof(PunishmentService, 'muteUser'), () => {
  test('adds mute punishment to database', async () => {
    mockRankStore.removeUserRank
      .calledWith(expect.objectContaining<Partial<RemoveUserRankArgs>>({ rank: 'mute' }))
      .mockRejectedValue(new UserRankNotFoundError())
    const newPunishment: any = {}
    mockRankStore.addUserRank
      .calledWith(expect.objectContaining<Partial<AddUserRankArgs>>({ userId: userId1, rank: 'mute', expirationTime: expect.any(Date) }))
      .mockResolvedValue(newPunishment)

    const result = await punishmentService.muteUser(userId1, 'test', 10)

    expect(mockRankStore.removeUserRank).toHaveBeenCalled()
    expect(result).toBe(newPunishment)
  })

  test('mute is permanent if duration is null', async () => {
    mockRankStore.removeUserRank.mockResolvedValue({} as any)
    const newPunishment: any = {}
    mockRankStore.addUserRank
      .calledWith(expect.objectContaining<Partial<AddUserRankArgs>>({ userId: userId1, rank: 'mute', expirationTime: null }))
      .mockResolvedValue(newPunishment)

    const result = await punishmentService.muteUser(userId1, 'test', null)

    expect(mockRankStore.removeUserRank).toHaveBeenCalled()
    expect(result).toBe(newPunishment)
  })
})

describe(nameof(PunishmentService, 'timeoutUser'), () => {
  test('times out user on platforms and adds database entry', async () => {
    const contextToken1 = 'testToken1'
    const contextToken2 = 'testToken2'
    const error1 = 'error1'
    const error3 = 'error3'
    mockMasterchatProxyService.timeout.calledWith(contextToken1).mockRejectedValue(new Error(error1))
    mockMasterchatProxyService.timeout.calledWith(contextToken2).mockResolvedValue(true)
    mockTwurpleService.timeout.calledWith(1, 'test', 1000).mockRejectedValue(new Error(error3))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(1).mockResolvedValue({ contextToken: contextToken1 } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(2).mockResolvedValue({ contextToken: contextToken2 } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(3).mockResolvedValue({ contextToken: null } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(4).mockResolvedValue(null)
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({
      userId: userId1,
      youtubeChannels: [1, 2, 3, 4],
      twitchChannels: [1, 2]
    })

    const newPunishment: Partial<UserRankWithRelations> = {
      id: 5,
      userId: userId1,
      expirationTime: addTime(new Date(), 'seconds', 1000)
    }
    mockRankStore.removeUserRank.calledWith(expect.objectContaining<Partial<RemoveUserRankArgs>>({ rank: 'timeout' })).mockRejectedValue(new UserRankNotFoundError())
    mockRankStore.addUserRank.calledWith(expect.objectContaining<Partial<AddUserRankArgs>>({ userId: userId1, rank: 'timeout' })).mockResolvedValue(newPunishment as UserRankWithRelations)

    const result = await punishmentService.timeoutUser(userId1, 'test', 1000)

    expect(mockRankStore.removeUserRank).toHaveBeenCalled()
    expect(result.punishment).toBe(newPunishment)
    expect(result.youtubeResults).toEqual<YoutubePunishmentResult[]>([
      { youtubeChannelId: 1, error: error1 },
      { youtubeChannelId: 2, error: null },
      { youtubeChannelId: 3, error: expect.anything() },
      { youtubeChannelId: 4, error: expect.anything() }
    ])
    expect(result.twitchResults).toEqual<TwitchPunishmentResult[]>([
      { twitchChannelId: 1, error: error3 },
      { twitchChannelId: 2, error: null }
    ])

    const suppliedContextTokens = mockMasterchatProxyService.timeout.mock.calls.map(c => single(c))
    expect(suppliedContextTokens).toEqual([contextToken1, contextToken2])
    
    const suppliedTwitchChannelIds = mockTwurpleService.timeout.mock.calls
    expect(suppliedTwitchChannelIds).toEqual([[1, any(), 1000], [2, any(), 1000]])

    const youtubeTimeoutRefreshArgs = single(mockYoutubeTimeoutRefreshService.startTrackingTimeout.mock.calls)
    expect(youtubeTimeoutRefreshArgs).toEqual([newPunishment.id, newPunishment.expirationTime, false, expect.any(Function)])

    // ensure that the youtube punishment is re-applied when required
    const onRefresh = youtubeTimeoutRefreshArgs[3]
    mockMasterchatProxyService.timeout.mockClear()
    await onRefresh()
    const resuppliedContextTokens = mockMasterchatProxyService.timeout.mock.calls.map(c => single(c))
    expect(resuppliedContextTokens).toEqual([contextToken1, contextToken2])
  })
})

describe(nameof(PunishmentService, 'getCurrentPunishments'), () => {
  test('gets punishments that are active', async () => {
    mockRankStore.getUserRanksForGroup.calledWith('punishment').mockResolvedValue([ activeTimeout, activeBan])
  
    const result = await punishmentService.getCurrentPunishments()

    expect(result).toEqual([activeTimeout, activeBan])
  })
})

describe(nameof(PunishmentService, 'getPunishmentHistory'), () => {
  test('gets history from store and returns', async () => {
    const history = [activeBan, activeModRank, revokedBan, expiredMute]
    mockRankStore.getUserRankHistory.calledWith(userId1).mockResolvedValue(history)

    const result = await punishmentService.getPunishmentHistory(userId1)

    expect(result).toEqual([activeBan, revokedBan, expiredMute])
  })
})

describe(nameof(PunishmentService, 'unbanUser'), () => {
  test('unbans user on platforms and revokes ban in database', async () => {
    const contextToken1 = 'testToken1'
    const contextToken2 = 'testToken2'
    mockMasterchatProxyService.unbanYoutubeChannel.calledWith(contextToken1).mockResolvedValue(true)
    mockMasterchatProxyService.unbanYoutubeChannel.calledWith(contextToken2).mockResolvedValue(true)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(1).mockResolvedValue({ contextToken: contextToken1 } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(2).mockResolvedValue({ contextToken: contextToken2 } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(3).mockResolvedValue({ contextToken: null } as Partial<ChatItemWithRelations> as any)
    mockChatStore.getLastChatByYoutubeChannel.calledWith(4).mockResolvedValue(null)
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({
      userId: userId1,
      youtubeChannels: [1, 2, 3, 4],
      twitchChannels: [1, 2]
    })
    const revokedPunishment: any = {}
    mockRankStore.removeUserRank.calledWith(expect.objectContaining<Partial<RemoveUserRankArgs>>({ userId: userId1, rank: 'ban' })).mockResolvedValue(revokedPunishment)

    const result = await punishmentService.unbanUser(userId1, 'test')
    
    expect(result.punishment).toBe(revokedPunishment)
    expect(result.youtubeResults).toEqual<YoutubePunishmentResult[]>([
      { youtubeChannelId: 1, error: null },
      { youtubeChannelId: 2, error: null },
      { youtubeChannelId: 3, error: expect.anything() },
      { youtubeChannelId: 4, error: expect.anything() }
    ])
    expect(result.twitchResults).toEqual<TwitchPunishmentResult[]>([
      { twitchChannelId: 1, error: null },
      { twitchChannelId: 2, error: null }
    ])

    const suppliedContextTokens = mockMasterchatProxyService.unbanYoutubeChannel.mock.calls.map(c => single(c))
    expect(suppliedContextTokens).toEqual([contextToken1, contextToken2])

    const suppliedTwitchChannelIds = mockTwurpleService.unbanChannel.mock.calls.map(c => c[0])
    expect(suppliedTwitchChannelIds).toEqual([1, 2])
  })

  test('returns null and does not make database change if ban is already revoked', async () => {
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({ userId: userId1, youtubeChannels: [], twitchChannels: [] })
    mockRankStore.removeUserRank.calledWith(expect.objectContaining<Partial<RemoveUserRankArgs>>({ userId: userId1, rank: 'ban' })).mockRejectedValue(new UserRankNotFoundError())

    const result = await punishmentService.unbanUser(userId1, 'test')
    
    expect(result.punishment).toBeNull()
  })
})


describe(nameof(PunishmentService, 'unmuteUser'), () => {
  test('adds mute to database', async () => {
    const expectedResult: any = {}
    mockRankStore.removeUserRank.calledWith(expect.objectContaining<Partial<RemoveUserRankArgs>>({ userId: userId1, rank: 'mute' })).mockResolvedValue(expectedResult)

    const result = await punishmentService.unmuteUser(userId1, 'test')

    expect(result).toBe(expectedResult)
  })

  test('returns null and does not make database change if there is no active mute', async () => {
    mockRankStore.removeUserRank.calledWith(expect.objectContaining<Partial<RemoveUserRankArgs>>({ userId: userId1, rank: 'mute' })).mockRejectedValue(new UserRankNotFoundError())

    const result = await punishmentService.unmuteUser(userId1, 'test')
    
    expect(result).toBeNull()
  })
})

describe(nameof(PunishmentService, 'untimeoutUser'), () => {
  test('untimeouts user on twitch and revokes timeout in database', async () => {
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({
      userId: userId1,
      youtubeChannels: [1, 2, 3, 4],
      twitchChannels: [1, 2]
    })
    mockRankStore.getUserRanks.calledWith(expect.arrayContaining([userId1])).mockResolvedValue([{ userId: userId1, ranks: [activeMute, activeTimeout, activeModRank] }])
    const expectedResult: any = {}
    mockRankStore.removeUserRank.calledWith(expect.objectContaining<Partial<RemoveUserRankArgs>>({ userId: userId1, rank: 'timeout' })).mockResolvedValue(expectedResult)

    const result = await punishmentService.untimeoutUser(userId1, 'test')
    
    expect(result.punishment).toBe(expectedResult)
    expect(result.youtubeResults).toEqual<YoutubePunishmentResult[]>([
      { youtubeChannelId: 1, error: expect.stringContaining(`YouTube timeouts expire automatically`) },
      { youtubeChannelId: 2, error: expect.stringContaining(`YouTube timeouts expire automatically`) },
      { youtubeChannelId: 3, error: expect.anything() },
      { youtubeChannelId: 4, error: expect.anything() }
    ])
    expect(result.twitchResults).toEqual<TwitchPunishmentResult[]>([
      { twitchChannelId: 1, error: null },
      { twitchChannelId: 2, error: null }
    ])

    expect(mockMasterchatProxyService.timeout.mock.calls.length).toBe(0)

    const suppliedTwitchChannelIds = mockTwurpleService.untimeout.mock.calls.map(c => c[0])
    expect(suppliedTwitchChannelIds).toEqual([1, 2])

    const stopTrackingArgs = single(mockYoutubeTimeoutRefreshService.stopTrackingTimeout.mock.calls)
    expect(stopTrackingArgs[0]).toBe(activeTimeout.id)
  })

  test('returns null and does not make database change if timeout is already revoked', async () => {
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({ userId: userId1, youtubeChannels: [], twitchChannels: [] })
    mockRankStore.getUserRanks.calledWith(expect.arrayContaining([userId1])).mockResolvedValue([{ userId: userId1, ranks: [activeMute, activeModRank] }])
    mockRankStore.removeUserRank.calledWith(expect.objectContaining<Partial<RemoveUserRankArgs>>({ userId: userId1, rank: 'timeout' })).mockRejectedValue(new UserRankNotFoundError())

    const result = await punishmentService.untimeoutUser(userId1, 'test')
    
    expect(result.punishment).toBeNull()
    expect(mockYoutubeTimeoutRefreshService.stopTrackingTimeout.mock.calls.length).toBe(0)
  })
})
