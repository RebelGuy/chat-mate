import { Punishment } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import PunishmentService from '@rebel/server/services/PunishmentService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import PunishmentStore, { CreatePunishmentArgs } from '@rebel/server/stores/PunishmentStore'
import { nameof, single } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { addTime } from '@rebel/server/util/datetime'
import { ChatItemWithRelations } from '@rebel/server/models/chat'

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

let mockMasterchatProxyService: MockProxy<MasterchatProxyService>
let mockPunishmentStore: MockProxy<PunishmentStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockChatStore: MockProxy<ChatStore>
let punishmentService: PunishmentService

beforeEach(() => {
  mockMasterchatProxyService = mock()
  mockPunishmentStore = mock()
  mockChannelStore = mock()
  mockChatStore = mock()

  punishmentService = new PunishmentService(new Dependencies({
    logService: mock(),
    masterchatProxyService: mockMasterchatProxyService,
    punishmentStore: mockPunishmentStore,
    channelStore: mockChannelStore,
    chatStore: mockChatStore
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
      twitchChannels: [] // todo
    })
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([])

    await punishmentService.banUser(userId1, 'test')

    const suppliedContextTokens = mockMasterchatProxyService.banYoutubeChannel.mock.calls.map(c => single(c))
    expect(suppliedContextTokens).toEqual([contextToken1, contextToken2])
    
    const suppliedPunishmentStoreArgs: CreatePunishmentArgs = single(single(mockPunishmentStore.addPunishment.mock.calls))
    expect(suppliedPunishmentStoreArgs).toEqual(expect.objectContaining<Partial<CreatePunishmentArgs>>({ userId: userId1, type: 'ban' }))
  })

  test('re-applies ban in database if one already exists', async () => {
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({ userId: userId1, youtubeChannels: [], twitchChannels: [] })
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([activeBan])

    await punishmentService.banUser(userId1, 'test')

    const revokedArgs = single(mockPunishmentStore.revokePunishment.mock.calls)
    expect(revokedArgs[0]).toBe(activeBan.id)
    const createArgs: CreatePunishmentArgs = single(single(mockPunishmentStore.addPunishment.mock.calls))
    expect(createArgs).toEqual(expect.objectContaining<Partial<CreatePunishmentArgs>>({ userId: userId1, type: 'ban' }))
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
      twitchChannels: [] // todo
    })
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([activeBan])

    await punishmentService.unbanUser(userId1, 'test')

    const suppliedContextTokens = mockMasterchatProxyService.unbanYoutubeChannel.mock.calls.map(c => single(c))
    expect(suppliedContextTokens).toEqual([contextToken1, contextToken2])
    
    const revokePunishmentArgs = single(mockPunishmentStore.revokePunishment.mock.calls)
    expect(revokePunishmentArgs[0]).toEqual(activeBan.id)
  })

  test('does not make database change if ban is already revoked', async () => {
    mockChannelStore.getUserOwnedChannels.calledWith(userId1).mockResolvedValue({ userId: userId1, youtubeChannels: [], twitchChannels: [] })
    mockPunishmentStore.getPunishmentsForUser.calledWith(userId1).mockResolvedValue([revokedBan])

    await punishmentService.unbanUser(userId1, 'test')

    expect(mockPunishmentStore.addPunishment.mock.calls.length).toBe(0)
  })
})
