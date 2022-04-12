import { Punishment } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import PunishmentService from '@rebel/server/services/PunishmentService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import PunishmentStore, { CreatePunishmentArgs } from '@rebel/server/stores/PunishmentStore'
import { nameof, single } from '@rebel/server/_test/utils'
import { any, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { addTime } from '@rebel/server/util/datetime'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import TwurpleService from '@rebel/server/services/TwurpleService'

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
let punishmentService: PunishmentService

beforeEach(() => {
  mockMasterchatProxyService = mock()
  mockPunishmentStore = mock()
  mockChannelStore = mock()
  mockChatStore = mock()
  mockTwurpleService = mock()

  punishmentService = new PunishmentService(new Dependencies({
    logService: mock(),
    masterchatProxyService: mockMasterchatProxyService,
    punishmentStore: mockPunishmentStore,
    channelStore: mockChannelStore,
    chatStore: mockChatStore,
    twurpleService: mockTwurpleService
  }))
})

describe(nameof(PunishmentService, 'banUser'), () => {
  test('bans user on platforms and adds database entry', async () => {
    const contextToken1 = 'testToken1'
    const contextToken2 = 'testToken2'
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
    const expectedResult: any = {}
    mockPunishmentStore.addPunishment.calledWith(expect.objectContaining<Partial<CreatePunishmentArgs>>({ userId: userId1, type: 'ban' })).mockResolvedValue(expectedResult)

    const result = await punishmentService.banUser(userId1, 'test')

    expect(result).toBe(expectedResult)

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
    expect(result).toBe(expectedResult)
  })
})

describe(nameof(PunishmentService, 'muteUser'), () => {
  test('adds mute punishment to database', async () => {
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([])
    const expectedResult: any = {}
    mockPunishmentStore.addPunishment.calledWith(expect.objectContaining<Partial<CreatePunishmentArgs>>({ userId: userId1, type: 'mute' })).mockResolvedValue(expectedResult)

    const result = await punishmentService.muteUser(userId1, 'test', 10)

    expect(result).toBe(expectedResult)
  })

  test('re-applies mute in database if one already exists', async () => {
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([activeBan, activeMute])
    const expectedResult: any = {}
    mockPunishmentStore.addPunishment.calledWith(expect.objectContaining<Partial<CreatePunishmentArgs>>({ userId: userId1, type: 'mute' })).mockResolvedValue(expectedResult)

    const result = await punishmentService.muteUser(userId1, 'test', 100)

    const revokedArgs = single(mockPunishmentStore.revokePunishment.mock.calls)
    expect(revokedArgs[0]).toBe(activeMute.id)
    expect(result).toBe(expectedResult)
  })
})

describe(nameof(PunishmentService, 'timeoutUser'), () => {
  test('times out user on platforms and adds database entry', async () => {
    const contextToken1 = 'testToken1'
    const contextToken2 = 'testToken2'
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
    const expectedResult: any = {}
    mockPunishmentStore.addPunishment.calledWith(expect.objectContaining<Partial<CreatePunishmentArgs>>({ userId: userId1, type: 'timeout' })).mockResolvedValue(expectedResult)

    const result = await punishmentService.timeoutUser(userId1, 'test', 10)

    expect(result).toBe(expectedResult)

    const suppliedContextTokens = mockMasterchatProxyService.timeout.mock.calls.map(c => single(c))
    expect(suppliedContextTokens).toEqual([contextToken1, contextToken2])
    
    const suppliedTwitchChannelIds = mockTwurpleService.timeout.mock.calls
    expect(suppliedTwitchChannelIds).toEqual([[1, any(), 10], [2, any(), 10]])
  })

  test('re-applies timeout in database if one already exists', async () => {
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({ userId: userId1, youtubeChannels: [], twitchChannels: [] })
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([activeTimeout, activeBan, activeMute])
    const expectedResult: any = {}
    mockPunishmentStore.addPunishment.calledWith(expect.objectContaining<Partial<CreatePunishmentArgs>>({ userId: userId1, type: 'timeout' })).mockResolvedValue(expectedResult)

    const result = await punishmentService.timeoutUser(userId1, 'test', 10)

    const revokedArgs = single(mockPunishmentStore.revokePunishment.mock.calls)
    expect(revokedArgs[0]).toBe(activeTimeout.id)
    expect(result).toBe(expectedResult)
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
    const expectedResult: any = {}
    mockPunishmentStore.revokePunishment.calledWith(activeBan.id, any(), any()).mockResolvedValue(expectedResult)

    const result = await punishmentService.unbanUser(userId1, 'test')
    
    expect(result).toBe(expectedResult)

    const suppliedContextTokens = mockMasterchatProxyService.unbanYoutubeChannel.mock.calls.map(c => single(c))
    expect(suppliedContextTokens).toEqual([contextToken1, contextToken2])

    const suppliedTwitchChannelIds = mockTwurpleService.unbanChannel.mock.calls.map(c => c[0])
    expect(suppliedTwitchChannelIds).toEqual([1, 2])
  })

  test('returns null and does not make database change if ban is already revoked', async () => {
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({ userId: userId1, youtubeChannels: [], twitchChannels: [] })
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([revokedBan])

    const result = await punishmentService.unbanUser(userId1, 'test')
    
    expect(result).toBeNull()
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
    
    expect(result).toBe(expectedResult)

    expect(mockMasterchatProxyService.timeout.mock.calls.length).toBe(0)

    const suppliedTwitchChannelIds = mockTwurpleService.untimeout.mock.calls.map(c => c[0])
    expect(suppliedTwitchChannelIds).toEqual([1, 2])
  })

  test('returns null and does not make database change if ban is already revoked', async () => {
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({ userId: userId1, youtubeChannels: [], twitchChannels: [] })
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([revokedBan])

    const result = await punishmentService.untimeoutUser(userId1, 'test')
    
    expect(result).toBeNull()
    expect(mockPunishmentStore.addPunishment.mock.calls.length).toBe(0)
  })
})
