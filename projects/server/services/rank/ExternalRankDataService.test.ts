import { TwitchChannel } from '@prisma/client'
import ChannelService from '@rebel/server/services/ChannelService'
import ExternalRankDataService from '@rebel/server/services/rank/ExternalRankDataService'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { Dependencies } from '@rebel/shared/context/context'
import { nameof, cast, expectArray, expectObject } from '@rebel/shared/testUtils'
import { MockProxy, mock } from 'jest-mock-extended'

const streamerId = 54

let mockChannelService: MockProxy<ChannelService>
let mockChannelStore: MockProxy<ChannelStore>
let mockRankStore: MockProxy<RankStore>
let externalRankDataService: ExternalRankDataService

beforeEach(() => {
  mockChannelService = mock()
  mockChannelStore = mock()
  mockRankStore = mock()

  externalRankDataService = new ExternalRankDataService(new Dependencies({
    channelService: mockChannelService,
    channelStore: mockChannelStore,
    logService: mock(),
    rankStore: mockRankStore
  }))
})

describe(nameof(ExternalRankDataService, 'getTwitchDataForExternalRankEvent'), () => {
  test('Returns unknown id if the channel was not found', async () => {
    const userName = 'user'
    mockChannelStore.getChannelFromUserNameOrExternalId.calledWith(userName).mockResolvedValue(null)

    const result = await externalRankDataService.getTwitchDataForExternalRankEvent(2, userName, 'moderatorName', 'punishment')

    expect(result).toBeNull()
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
    mockChannelStore.getTwitchChannelsFromChannelIds.calledWith(expectArray<number>([channelId])).mockResolvedValue(cast<UserChannel<'twitch'>[]>([{ aggregateUserId: primaryUserId, platformInfo: { channel: { id: channelId }} }]))
    mockRankStore.getUserRanksForGroup.calledWith('punishment', streamerId).mockResolvedValue(ranks)
    mockChannelStore.getChannelFromUserNameOrExternalId.calledWith(moderatorName).mockResolvedValue(null)

    const result = await externalRankDataService.getTwitchDataForExternalRankEvent(streamerId, userName, moderatorName, 'punishment')

    expect(result).toEqual(expectObject(result, { primaryUserId, channelId, moderatorPrimaryUserId: null }))
    expect(result!.ranksForUser.length).toBe(1)
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
    mockChannelStore.getTwitchChannelsFromChannelIds.calledWith(expectArray<number>([channelId])).mockResolvedValue(cast<UserChannel<'twitch'>[]>([{ aggregateUserId: primaryUserId, platformInfo: { channel: { id: channelId }} }]))
    mockRankStore.getUserRanksForGroup.calledWith('administration', streamerId).mockResolvedValue(ranks)
    mockChannelStore.getChannelFromUserNameOrExternalId.calledWith(moderatorName).mockResolvedValue(cast<TwitchChannel>({ id: modChannelId, twitchId: '456' }))
    mockChannelStore.getTwitchChannelsFromChannelIds.calledWith(expectArray<number>([modChannelId])).mockResolvedValue(cast<UserChannel<'twitch'>[]>([{ aggregateUserId: moderatorPrimaryUserId }]))

    const result = await externalRankDataService.getTwitchDataForExternalRankEvent(streamerId, userName, moderatorName, 'administration')

    expect(result).toEqual(expectObject(result, { primaryUserId, channelId, moderatorPrimaryUserId }))
    expect(result!.ranksForUser.length).toBe(1)
  })
})

describe(nameof(ExternalRankDataService, 'getYoutubeDataForExternalRankEvent'), () => {
  test('Returns unknown id if the channel was not found', async () => {
    const userName = 'user'
    const allChannels = cast<UserChannel<'youtube'>[]>([
      { platformInfo: { platform: 'youtube', channel: { globalInfoHistory: [{ name: 'a' }]}} },
      { platformInfo: { platform: 'youtube', channel: { globalInfoHistory: [{ name: 'b' }]}} }
    ])
    mockChannelService.searchChannelsByName.calledWith(streamerId, userName).mockResolvedValue(allChannels)

    const result = await externalRankDataService.getYoutubeDataForExternalRankEvent(streamerId, userName, 'mod', 'punishment')

    expect(result).toBeNull()
  })

  test('Returns unknown id if there are multiple matches', async () => {
    const userName = 'user'
    const matchedChannels = cast<UserChannel<'youtube'>[]>([
      { platformInfo: { platform: 'youtube', channel: { globalInfoHistory: [{ name: userName }]}} },
      { platformInfo: { platform: 'youtube', channel: { globalInfoHistory: [{ name: userName }]}} }
    ])
    mockChannelService.searchChannelsByName.calledWith(streamerId, userName).mockResolvedValue(matchedChannels)

    const result = await externalRankDataService.getYoutubeDataForExternalRankEvent(streamerId, userName, 'mod', 'punishment')

    expect(result).toBeNull()
  })

  test('Returns primary id of user and ranks without mod', async () => {
    const userName = 'user'
    const moderatorName = 'mod'
    const primaryUserId = 8
    const channelId = 512
    const userChannel = cast<UserChannel<'youtube'>>({
      aggregateUserId: primaryUserId,
      platformInfo: { platform: 'youtube', channel: { id: channelId, globalInfoHistory: [{ name: userName }]}}
    })
    const punishmentRanks = cast<UserRankWithRelations[]>([
      { primaryUserId: primaryUserId },
      { primaryUserId: primaryUserId + 2 }
    ])
    const administrationRanks = cast<UserRankWithRelations[]>([
      { primaryUserId: primaryUserId - 1, rank: { name: 'mod' } },
      { primaryUserId: primaryUserId - 2, rank: { name: 'owner' } }
    ])

    mockChannelService.searchChannelsByName.calledWith(streamerId, userName).mockResolvedValue([userChannel])
    mockChannelService.searchChannelsByName.calledWith(streamerId, moderatorName).mockResolvedValue([])
    mockRankStore.getUserRanksForGroup.calledWith('punishment', streamerId).mockResolvedValue(punishmentRanks)
    mockRankStore.getUserRanksForGroup.calledWith('administration', streamerId).mockResolvedValue(administrationRanks)

    const result = await externalRankDataService.getYoutubeDataForExternalRankEvent(streamerId, userName, moderatorName, 'punishment')

    expect(result).toEqual(expectObject(result, { primaryUserId, channelId, moderatorPrimaryUserId: null }))
    expect(result!.ranksForUser.length).toBe(1)
  })

  test('Returns primary id of user and ranks with mod', async () => {
    const userName = 'user'
    const ownerName = 'owner'
    const primaryUserId = 8
    const ownerPrimaryUserId = 6
    const channelId = 235
    const userChannel = cast<UserChannel<'youtube'>>({
      aggregateUserId: primaryUserId,
      platformInfo: { platform: 'youtube', channel: { id: channelId, globalInfoHistory: [{ name: userName }]}}
    })
    // the true owner
    const userWithOwnerName1 = cast<UserChannel<'youtube'>>({
      aggregateUserId: ownerPrimaryUserId,
      platformInfo: { platform: 'youtube', channel: { globalInfoHistory: [{ name: ownerName }]}}
    })
    // another channel with the same name as the owner
    const userWithOwnerName2 = cast<UserChannel<'youtube'>>({
      aggregateUserId: ownerPrimaryUserId - 1,
      platformInfo: { platform: 'youtube', channel: { globalInfoHistory: [{ name: ownerName }]}}
    })

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

    mockChannelService.searchChannelsByName.calledWith(streamerId, userName).mockResolvedValue([userChannel])
    mockChannelService.searchChannelsByName.calledWith(streamerId, ownerName).mockResolvedValue([userWithOwnerName1, userWithOwnerName2])
    mockRankStore.getUserRanksForGroup.calledWith('punishment', streamerId).mockResolvedValue(punishmentRanks)
    mockRankStore.getUserRanksForGroup.calledWith('administration', streamerId).mockResolvedValue(administrationRanks)

    const result = await externalRankDataService.getYoutubeDataForExternalRankEvent(streamerId, userName, ownerName, 'punishment')

    expect(result).toEqual(expectObject(result, { primaryUserId, channelId, moderatorPrimaryUserId: ownerPrimaryUserId }))
    expect(result!.ranksForUser.length).toBe(1)
  })
})
