import { Punishment } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import PunishmentService, { TwitchPunishmentResult, YoutubePunishmentResult } from '@rebel/server/services/PunishmentService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import PunishmentStore, { CreatePunishmentArgs } from '@rebel/server/stores/PunishmentStore'
import { nameof, single } from '@rebel/server/_test/utils'
import { any, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { addTime } from '@rebel/server/util/datetime'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import TwurpleService from '@rebel/server/services/TwurpleService'
import YoutubeTimeoutRefreshService from '@rebel/server/services/YoutubeTimeoutRefreshService'

export const userId1 = 2

export const expiredTimeout: Punishment = {
  id: 1,
  adminUserId: 1,
  userId: userId1,
  expirationTime: addTime(data.time1, 'seconds', 1),
  punishmentType: 'timeout',
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null
}
export const activeTimeout: Punishment = {
  id: 2,
  adminUserId: 1,
  userId: userId1,
  expirationTime: addTime(new Date(), 'hours', 1),
  punishmentType: 'timeout',
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null
}
export const revokedBan: Punishment = {
  id: 3,
  adminUserId: 1,
  userId: userId1,
  expirationTime: null,
  punishmentType: 'ban',
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: addTime(data.time1, 'seconds', 1)
}
export const activeBan: Punishment = {
  id: 4,
  adminUserId: 1,
  userId: userId1,
  expirationTime: null,
  punishmentType: 'ban',
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null
}
export const expiredMute: Punishment = {
  id: 5,
  adminUserId: 1,
  userId: userId1,
  expirationTime: addTime(data.time1, 'seconds', 1),
  punishmentType: 'mute',
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null
}
export const activeMute: Punishment = {
  id: 6,
  adminUserId: 1,
  userId: userId1,
  expirationTime: addTime(new Date(), 'hours', 1),
  punishmentType: 'mute',
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null
}

let mockMasterchatProxyService: MockProxy<MasterchatProxyService>
let mockPunishmentStore: MockProxy<PunishmentStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockChatStore: MockProxy<ChatStore>
let mockTwurpleService: MockProxy<TwurpleService>
let mockYoutubeTimeoutRefreshService: MockProxy<YoutubeTimeoutRefreshService>
let punishmentService: PunishmentService

beforeEach(() => {
  mockMasterchatProxyService = mock()
  mockPunishmentStore = mock()
  mockChannelStore = mock()
  mockChatStore = mock()
  mockTwurpleService = mock()
  mockYoutubeTimeoutRefreshService = mock()

  punishmentService = new PunishmentService(new Dependencies({
    logService: mock(),
    masterchatProxyService: mockMasterchatProxyService,
    punishmentStore: mockPunishmentStore,
    channelStore: mockChannelStore,
    chatStore: mockChatStore,
    twurpleService: mockTwurpleService,
    youtubeTimeoutRefreshService: mockYoutubeTimeoutRefreshService
  }))
})

describe(nameof(PunishmentService, 'initialise'), () => {
  test('sets up timeout refreshing timers', async () => {
    const timeout1: Partial<Punishment> = {
      punishmentType: 'timeout',
      id: 1,
      userId: 3,
      expirationTime: addTime(new Date(), 'seconds', 1000)
    }
    const timeout2: Partial<Punishment> = {
      punishmentType: 'timeout',
      id: 2,
      userId: 4,
      expirationTime: addTime(new Date(), 'seconds', 1000)
    }
    const currentPunishments: Partial<Punishment>[] = [{ punishmentType: 'ban' }, timeout1, timeout2]
    mockPunishmentStore.getPunishments.mockResolvedValue(currentPunishments as Punishment[])

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
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([])
    const newPunishment: any = {}
    mockPunishmentStore.addPunishment.calledWith(expect.objectContaining<Partial<CreatePunishmentArgs>>({ userId: userId1, type: 'ban' })).mockResolvedValue(newPunishment)

    const result = await punishmentService.banUser(userId1, 'test')

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

  test('re-applies ban in database if one already exists', async () => {
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({ userId: userId1, youtubeChannels: [], twitchChannels: [] })
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([activeBan])
    const expectedResult: any = {}
    mockPunishmentStore.addPunishment.calledWith(expect.objectContaining<Partial<CreatePunishmentArgs>>({ userId: userId1, type: 'ban' })).mockResolvedValue(expectedResult)

    const result = await punishmentService.banUser(userId1, 'test')

    const revokedArgs = single(mockPunishmentStore.revokePunishment.mock.calls)
    expect(revokedArgs[0]).toBe(activeBan.id)
    expect(result.punishment).toBe(expectedResult)
  })
})

describe(nameof(PunishmentService, 'isUserPunished'), () => {
  test('returns false if there are no active punishments for the user', async () => {
    const punishment1: Partial<Punishment> = {
      expirationTime: addTime(new Date(), 'hours', -1)
    }
    const punishment2: Partial<Punishment> = {
      revokedTime: addTime(new Date(), 'hours', -1)
    }
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([punishment1 as Punishment, punishment2 as Punishment])
  
    const result = await punishmentService.isUserPunished(userId1)

    expect(result).toBe(false)
  })

  test('returns true if there are active punishments for the user', async () => {
    const punishment: Partial<Punishment> = {
      expirationTime: addTime(new Date(), 'hours', 1)
    }
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([punishment as Punishment])
  
    const result = await punishmentService.isUserPunished(userId1)

    expect(result).toBe(true)
  })
})

describe(nameof(PunishmentService, 'muteUser'), () => {
  test('adds mute punishment to database', async () => {
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([])
    const expectedResult: any = {}
    mockPunishmentStore.addPunishment.calledWith(
      expect.objectContaining<Partial<CreatePunishmentArgs>>({ userId: userId1, type: 'mute', expirationTime: expect.any(Date) })
    ).mockResolvedValue(expectedResult)

    const result = await punishmentService.muteUser(userId1, 'test', 10)

    expect(result).toBe(expectedResult)
  })

  test('re-applies mute in database if one already exists', async () => {
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([activeBan, activeMute])
    const expectedResult: any = {}
    mockPunishmentStore.addPunishment.calledWith(
      expect.objectContaining<Partial<CreatePunishmentArgs>>({ userId: userId1, type: 'mute', expirationTime: expect.any(Date) })
    ).mockResolvedValue(expectedResult)

    const result = await punishmentService.muteUser(userId1, 'test', 100)

    const revokedArgs = single(mockPunishmentStore.revokePunishment.mock.calls)
    expect(revokedArgs[0]).toBe(activeMute.id)
    expect(result).toBe(expectedResult)
  })

  test('mute is permanent if duration is null', async () => {
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([])
    const expectedResult: any = {}
    mockPunishmentStore.addPunishment.calledWith(expect.objectContaining<Partial<CreatePunishmentArgs>>({ userId: userId1, type: 'mute', expirationTime: null })).mockResolvedValue(expectedResult)

    const result = await punishmentService.muteUser(userId1, 'test', null)

    expect(result).toBe(expectedResult)
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
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([])
    const newPunishment: Partial<Punishment> = {
      id: 5,
      userId: userId1,
      expirationTime: addTime(new Date(), 'seconds', 1000)
    }
    mockPunishmentStore.addPunishment.calledWith(expect.objectContaining<Partial<CreatePunishmentArgs>>({ userId: userId1, type: 'timeout' })).mockResolvedValue(newPunishment as Punishment)

    const result = await punishmentService.timeoutUser(userId1, 'test', 1000)

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

  test('re-applies timeout in database if one already exists', async () => {
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({ userId: userId1, youtubeChannels: [], twitchChannels: [] })
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([activeTimeout, activeBan, activeMute])
    const expectedResult: any = {}
    mockPunishmentStore.addPunishment.calledWith(expect.objectContaining<Partial<CreatePunishmentArgs>>({ userId: userId1, type: 'timeout' })).mockResolvedValue(expectedResult)

    const result = await punishmentService.timeoutUser(userId1, 'test', 10)

    const revokedArgs = single(mockPunishmentStore.revokePunishment.mock.calls)
    expect(revokedArgs[0]).toBe(activeTimeout.id)

    const stopTrackingArgs = single(mockYoutubeTimeoutRefreshService.stopTrackingTimeout.mock.calls)
    expect(stopTrackingArgs[0]).toBe(activeTimeout.id)

    expect(result.punishment).toBe(expectedResult)
  })
})

describe(nameof(PunishmentService, 'getCurrentPunishments'), () => {
  test('gets punishments that are active', async () => {
    mockPunishmentStore.getPunishments.mockResolvedValue([expiredTimeout, activeTimeout, revokedBan, activeBan])
  
    const result = await punishmentService.getCurrentPunishments()

    expect(result).toEqual([activeTimeout, activeBan])
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
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([activeBan])
    const revokedPunishment: any = {}
    mockPunishmentStore.revokePunishment.calledWith(activeBan.id, any(), any()).mockResolvedValue(revokedPunishment)

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
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([revokedBan])

    const result = await punishmentService.unbanUser(userId1, 'test')
    
    expect(result.punishment).toBeNull()
    expect(mockPunishmentStore.addPunishment.mock.calls.length).toBe(0)
  })
})


describe(nameof(PunishmentService, 'unmuteUser'), () => {
  test('adds mute to database', async () => {
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([activeMute])
    const expectedResult: any = {}
    mockPunishmentStore.revokePunishment.calledWith(activeMute.id, any(), any()).mockResolvedValue(expectedResult)

    const result = await punishmentService.unmuteUser(userId1, 'test')

    expect(result).toBe(expectedResult)
  })

  test('returns null and does not make database change if there is no active mute', async () => {
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([expiredMute])

    const result = await punishmentService.unmuteUser(userId1, 'test')
    
    expect(result).toBeNull()
    expect(mockPunishmentStore.addPunishment.mock.calls.length).toBe(0)
  })
})

describe(nameof(PunishmentService, 'untimeoutUser'), () => {
  test('untimeouts user on twitch and revokes timeout in database', async () => {
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({
      userId: userId1,
      youtubeChannels: [1, 2, 3, 4],
      twitchChannels: [1, 2]
    })
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([activeTimeout])
    const expectedResult: any = {}
    mockPunishmentStore.revokePunishment.calledWith(activeTimeout.id, any(), any()).mockResolvedValue(expectedResult)

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

  test('returns null and does not make database change if ban is already revoked', async () => {
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({ userId: userId1, youtubeChannels: [], twitchChannels: [] })
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([revokedBan])

    const result = await punishmentService.untimeoutUser(userId1, 'test')
    
    expect(result.punishment).toBeNull()
    expect(mockPunishmentStore.addPunishment.mock.calls.length).toBe(0)
    expect(mockYoutubeTimeoutRefreshService.stopTrackingTimeout.mock.calls.length).toBe(0)
  })
})
