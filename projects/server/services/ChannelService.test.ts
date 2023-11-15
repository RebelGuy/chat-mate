import { Dependencies } from '@rebel/shared/context/context'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import ChannelService from '@rebel/server/services/ChannelService'
import ChannelStore, { YoutubeChannelWithLatestInfo, TwitchChannelWithLatestInfo, UserChannel, UserOwnedChannels } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import { cast, expectArray, expectObject, expectObjectDeep, nameof } from '@rebel/shared/testUtils'
import { single, sortBy } from '@rebel/shared/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import AccountService from '@rebel/server/services/AccountService'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { TwitchChannel, YoutubeChannel } from '@prisma/client'

const streamerId = 5

let mockChannelStore: MockProxy<ChannelStore>
let mockChatStore: MockProxy<ChatStore>
let mockAccountService: MockProxy<AccountService>
let mockRankStore: MockProxy<RankStore>
let channelService: ChannelService

beforeEach(() => {
  mockChannelStore = mock()
  mockChatStore = mock()
  mockAccountService = mock()
  mockRankStore = mock()

  channelService = new ChannelService(new Dependencies({
    channelStore: mockChannelStore,
    chatStore: mockChatStore,
    accountService: mockAccountService,
    rankStore: mockRankStore,
    logService: mock()
  }))
})

describe(nameof(ChannelService, 'getActiveUserChannels'), () => {
  const channel1: YoutubeChannelWithLatestInfo = {} as any
  const chatItem1 = cast<ChatItemWithRelations>({
    userId: 1,
    youtubeChannelId: 10, youtubeChannel: channel1,
    twitchChannelId: null, twitchChannel: null,
    time: data.time1,
    user: { aggregateChatUserId: 3 }
  })
  const channel2: TwitchChannelWithLatestInfo = {} as any
  const chatItem2 = cast<ChatItemWithRelations>({
    userId: 2,
    youtubeChannelId: null, youtubeChannel: null,
    twitchChannelId: 5, twitchChannel: channel2,
    time: data.time2,
    user: { aggregateChatUserId: null }
  })

  test('returns all active user channels', async () => {
    const primaryUserIds = [3, 2]
    mockAccountService.getStreamerPrimaryUserIds.calledWith(streamerId).mockResolvedValue(primaryUserIds)
    mockChatStore.getLastChatOfUsers.calledWith(streamerId, primaryUserIds).mockResolvedValue([chatItem1, chatItem2])

    const result = await channelService.getActiveUserChannels(streamerId, null)

    expect(result.length).toBe(2)
    expect(result.find(r => r.defaultUserId === 1)).toEqual(expectObjectDeep<UserChannel>({
      defaultUserId: 1,
      aggregateUserId: 3, // from chat item 1
      platformInfo: {
        platform: 'youtube',
        channel: channel1
      }
    }))
    expect(result.find(r => r.defaultUserId === 2)).toEqual(expectObjectDeep<UserChannel>({
      defaultUserId: 2,
      aggregateUserId: null,
      platformInfo: {
        platform: 'twitch',
        channel: channel2
      }
    }))
  })

  test('returns specified active user channels', async () => {
    mockChatStore.getLastChatOfUsers.calledWith(streamerId, expect.arrayContaining([3])).mockResolvedValue([chatItem1 as ChatItemWithRelations])

    const result = await channelService.getActiveUserChannels(streamerId, [3])

    expect(single(result)).toEqual(expect.objectContaining<UserChannel>({
      defaultUserId: 1,
      aggregateUserId: 3, // from chat item 1
      platformInfo: {
        platform: 'youtube',
        channel: channel1
      }
    }))
  })
})

describe(nameof(ChannelService, 'getConnectedUserChannels'), () => {
  test('Gets channel info of connected channels', async () => {
    const userId1 = 123
    const userId2 = 354
    const youtubeChannel1 = cast<UserChannel>({ platformInfo: { channel: { id: 10, infoHistory: [{ name: 'name1' }] }} })
    const youtubeChannel2 = cast<UserChannel>({ platformInfo: { channel: { id: 20, infoHistory: [{ name: 'name2' }] }} })
    const twitchChannel1 = cast<UserChannel>({ platformInfo: { channel: { id: 10, infoHistory: [{ userName: 'name3' }] }} })
    const twitchChannel2 = cast<UserChannel>({ platformInfo: { channel: { id: 25, infoHistory: [{ userName: 'name4' }] }} })
    const connectedChannelIds1 = cast<UserOwnedChannels>({
      userId: userId1,
      aggregateUserId: 45,
      youtubeChannelIds: [10],
      twitchChannelIds: [10, 25]
    })
    const connectedChannelIds2 = cast<UserOwnedChannels>({
      userId: userId2,
      aggregateUserId: null,
      youtubeChannelIds: [20],
      twitchChannelIds: []
    })
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([userId1, userId2])).mockResolvedValue([connectedChannelIds1, connectedChannelIds2])
    mockChannelStore.getYoutubeChannelFromChannelId.calledWith(expect.arrayContaining([10, 20])).mockResolvedValue([youtubeChannel1, youtubeChannel2])
    mockChannelStore.getTwitchChannelFromChannelId.calledWith(expect.arrayContaining([10, 25])).mockResolvedValue([twitchChannel1, twitchChannel2])

    const result = await channelService.getConnectedUserChannels([userId1, userId2])

    expect(result.length).toBe(2)
    expect(sortBy(result, c => c.userId)).toEqual(expectObjectDeep(result, [
      { aggregateUserId: 45, channels: [youtubeChannel1, twitchChannel1, twitchChannel2] },
      { aggregateUserId: null, channels: [youtubeChannel2] }
    ]))
  })
})

describe(nameof(ChannelService, 'getTwitchDataForExternalRankEvent'), () => {
  test('Returns unknown id if the channel was not found', async () => {
    const userName = 'user'
    mockChannelStore.getChannelFromUserNameOrExternalId.calledWith(userName).mockResolvedValue(null)

    const result = await channelService.getTwitchDataForExternalRankEvent(2, userName, 'mod')

    expect(result.primaryUserId).toBeNull()
  })

  test('Returns primary id of user and ranks without mod', async () => {
    const userName = 'user'
    const moderatorName = 'mod'
    const channelId = 5
    const primaryUserId = 8
    const ranks = cast<UserRankWithRelations[]>([
      { primaryUserId: primaryUserId },
      { primaryUserId: primaryUserId + 1 }
    ])

    mockChannelStore.getChannelFromUserNameOrExternalId.calledWith(userName).mockResolvedValue(cast<TwitchChannel>({ id: channelId, twitchId: '123' }))
    mockChannelStore.getTwitchChannelFromChannelId.calledWith(expectArray<number>([channelId])).mockResolvedValue(cast<UserChannel<'twitch'>[]>([{ aggregateUserId: primaryUserId }]))
    mockRankStore.getUserRanksForGroup.calledWith('punishment', streamerId).mockResolvedValue(ranks)
    mockChannelStore.getChannelFromUserNameOrExternalId.calledWith(moderatorName).mockResolvedValue(null)

    const result = await channelService.getTwitchDataForExternalRankEvent(streamerId, userName, moderatorName)

    expect(result).toEqual(expectObject(result, { primaryUserId, moderatorPrimaryUserId: null }))
    expect(result.punishmentRanksForUser.length).toBe(1)
  })

  test('Returns primary id of user and ranks with mod', async () => {
    const userName = 'user'
    const moderatorName = 'mod'
    const channelId = 5
    const modChannelId = 7
    const primaryUserId = 8
    const moderatorPrimaryUserId = 88
    const ranks = cast<UserRankWithRelations[]>([
      { primaryUserId: primaryUserId },
      { primaryUserId: primaryUserId + 1 }
    ])

    mockChannelStore.getChannelFromUserNameOrExternalId.calledWith(userName).mockResolvedValue(cast<TwitchChannel>({ id: channelId, twitchId: '123' }))
    mockChannelStore.getTwitchChannelFromChannelId.calledWith(expectArray<number>([channelId])).mockResolvedValue(cast<UserChannel<'twitch'>[]>([{ aggregateUserId: primaryUserId }]))
    mockRankStore.getUserRanksForGroup.calledWith('punishment', streamerId).mockResolvedValue(ranks)
    mockChannelStore.getChannelFromUserNameOrExternalId.calledWith(moderatorName).mockResolvedValue(cast<TwitchChannel>({ id: modChannelId, twitchId: '456' }))
    mockChannelStore.getTwitchChannelFromChannelId.calledWith(expectArray<number>([modChannelId])).mockResolvedValue(cast<UserChannel<'twitch'>[]>([{ aggregateUserId: moderatorPrimaryUserId }]))

    const result = await channelService.getTwitchDataForExternalRankEvent(streamerId, userName, moderatorName)

    expect(result).toEqual(expectObject(result, { primaryUserId, moderatorPrimaryUserId }))
    expect(result.punishmentRanksForUser.length).toBe(1)
  })
})

describe(nameof(ChannelService, 'getYoutubeDataForExternalRankEvent'), () => {
  test('Returns unknown id if the channel was not found', async () => {
    const userName = 'user'
    const allChannels = cast<UserChannel<'youtube'>[]>([
      { platformInfo: { platform: 'youtube', channel: { infoHistory: [{ name: 'a' }]}} },
      { platformInfo: { platform: 'youtube', channel: { infoHistory: [{ name: 'b' }]}} }
    ])
    mockChannelStore.getAllChannels.calledWith(streamerId).mockResolvedValue(allChannels)

    const result = await channelService.getYoutubeDataForExternalRankEvent(streamerId, userName, 'mod')

    expect(result.primaryUserId).toBeNull()
  })

  test('Returns unknown id if there are multiple matches', async () => {
    const userName = 'user'
    const allChannels = cast<UserChannel<'youtube'>[]>([
      { platformInfo: { platform: 'youtube', channel: { infoHistory: [{ name: userName }]}} },
      { platformInfo: { platform: 'youtube', channel: { infoHistory: [{ name: userName }]}} }
    ])
    mockChannelStore.getAllChannels.calledWith(streamerId).mockResolvedValue(allChannels)

    const result = await channelService.getYoutubeDataForExternalRankEvent(streamerId, userName, 'mod')

    expect(result.primaryUserId).toBeNull()
  })

  test('Returns primary id of user and ranks without mod', async () => {
    const userName = 'user'
    const moderatorName = 'mod'
    const primaryUserId = 8
    const allChannels = cast<UserChannel<'youtube'>[]>([
      {
        aggregateUserId: primaryUserId + 1,
        platformInfo: { platform: 'youtube', channel: { infoHistory: [{ name: 'a' }]}}
      },
      {
        aggregateUserId: primaryUserId,
        platformInfo: { platform: 'youtube', channel: { infoHistory: [{ name: userName }]}}
      }
    ])
    const punishmentRanks = cast<UserRankWithRelations[]>([
      { primaryUserId: primaryUserId },
      { primaryUserId: primaryUserId + 2 }
    ])
    const administrationRanks = cast<UserRankWithRelations[]>([
      { primaryUserId: primaryUserId - 1, rank: { name: 'mod' } },
      { primaryUserId: primaryUserId - 2, rank: { name: 'owner' } }
    ])

    mockChannelStore.getAllChannels.calledWith(streamerId).mockResolvedValue(allChannels)
    mockRankStore.getUserRanksForGroup.calledWith('punishment', streamerId).mockResolvedValue(punishmentRanks)
    mockRankStore.getUserRanksForGroup.calledWith('administration', streamerId).mockResolvedValue(administrationRanks)

    const result = await channelService.getYoutubeDataForExternalRankEvent(streamerId, userName, moderatorName)

    expect(result).toEqual(expectObject(result, { primaryUserId, moderatorPrimaryUserId: null }))
    expect(result.punishmentRanksForUser.length).toBe(1)
  })

  test('Returns primary id of user and ranks with mod', async () => {
    const userName = 'user'
    const ownerName = 'owner'
    const primaryUserId = 8
    const ownerPrimaryUserId = 6
    const allChannels = cast<UserChannel<'youtube'>[]>([
      {
        // the true owner
        aggregateUserId: ownerPrimaryUserId,
        platformInfo: { platform: 'youtube', channel: { infoHistory: [{ name: ownerName }]}}
      },
      {
        // another account with the same name as the owner
        aggregateUserId: ownerPrimaryUserId - 1,
        platformInfo: { platform: 'youtube', channel: { infoHistory: [{ name: ownerName }]}}
      },
      {
        aggregateUserId: primaryUserId,
        platformInfo: { platform: 'youtube', channel: { infoHistory: [{ name: userName }]}}
      }
    ])
    const punishmentRanks = cast<UserRankWithRelations[]>([
      { primaryUserId: primaryUserId },
      { primaryUserId: primaryUserId + 2 }
    ])
    const administrationRanks = cast<UserRankWithRelations[]>([
      // since the other account with the same name as the owner doesn't have any moderator ranks,
      // it will be excluded from the match and hence a unique moderator account is found
      { primaryUserId: ownerPrimaryUserId - 2, rank: { name: 'mod' } },
      { primaryUserId: ownerPrimaryUserId, rank: { name: 'owner' } }
    ])

    mockChannelStore.getAllChannels.calledWith(streamerId).mockResolvedValue(allChannels)
    mockRankStore.getUserRanksForGroup.calledWith('punishment', streamerId).mockResolvedValue(punishmentRanks)
    mockRankStore.getUserRanksForGroup.calledWith('administration', streamerId).mockResolvedValue(administrationRanks)

    const result = await channelService.getYoutubeDataForExternalRankEvent(streamerId, userName, ownerName)

    expect(result).toEqual(expectObject(result, { primaryUserId, moderatorPrimaryUserId: ownerPrimaryUserId }))
    expect(result.punishmentRanksForUser.length).toBe(1)
  })
})

describe(nameof(ChannelService, 'searchChannelsByName'), () => {
  test('returns best match', async () => {
    const allChannels: UserChannel[] = cast<UserChannel[]>([
      { platformInfo: { platform: 'youtube', channel: { infoHistory: [{ name: 'Mr Cool Guy' }] }} },
      { platformInfo: { platform: 'youtube', channel: { infoHistory: [{ name: 'Rebel_Guy' }] }} },
      { platformInfo: { platform: 'twitch', channel: { infoHistory: [{ displayName: 'Rebel_Guy2' }] }} },
      { platformInfo: { platform: 'twitch', channel: { infoHistory: [{ displayName: 'Test' }] }} },
    ])
    mockChannelStore.getAllChannels.calledWith(streamerId).mockResolvedValue(allChannels)

    const result = await channelService.searchChannelsByName(streamerId, 'rebel')

    expect(result.length).toBe(2)
    expect(result).toEqual(expectObjectDeep(result, [
      allChannels[1], allChannels[2]
    ]))
  })
})
