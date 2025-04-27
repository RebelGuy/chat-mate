import { Rank, YoutubeChannel } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import AdminService from '@rebel/server/services/rank/AdminService'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { cast, expectArray, nameof } from '@rebel/shared/testUtils'
import { mock, MockProxy } from 'jest-mock-extended'
import ChannelStore, { UserChannel } from '@rebel/server/stores/ChannelStore'

const primaryUser1 = 1
const primaryUser2 = 2
const primaryUser3 = 3

const adminRank = cast<Rank>({ name: 'admin' })
const modRank = cast<Rank>({ name: 'mod' })
const ownerRank = cast<Rank>({ name: 'owner' })

const twitchUsername = 'testUser'

let mockRankStore: MockProxy<RankStore>
let mockChannelStore: MockProxy<ChannelStore>
const mockChannelId = 'channelId'
let adminService: AdminService

beforeEach(() => {
  mockRankStore = mock()
  mockChannelStore = mock()

  adminService = new AdminService(new Dependencies({
    rankStore: mockRankStore,
    twitchUsername: twitchUsername,
    channelId: mockChannelId,
    channelStore: mockChannelStore
  }))
})

describe(nameof(AdminService, 'getAdminUsers'), () => {
  test('Returns the array of all current admin users', async () => {
    const streamerId = 2
    mockRankStore.getUserRanksForGroup.calledWith('administration', streamerId).mockResolvedValue(cast<UserRankWithRelations[]>([
      { primaryUserId: primaryUser1, rank: modRank },
      { primaryUserId: primaryUser1, rank: adminRank },
      { primaryUserId: primaryUser2, rank: ownerRank },
      { primaryUserId: primaryUser2, rank: adminRank },
      { primaryUserId: primaryUser3, rank: ownerRank },
      { primaryUserId: primaryUser3, rank: modRank }
    ]))

    const result = await adminService.getAdminUsers(streamerId)

    expect(result.map(r => r.chatUserId)).toEqual([primaryUser1, primaryUser2])
  })
})

describe(nameof(AdminService, 'getTwitchUsername'), () => {
  test('Returns the injected username', () => {
    const result = adminService.getTwitchUsername()

    expect(result).toBe(twitchUsername)
  })
})

describe(nameof(AdminService, 'getYoutubeChannelName'), () => {
  test(`Returns the admin channel's name`, async () => {
    const youtubeChannelId = 5
    const youtubeChannelName = 'testName'
    mockChannelStore.getChannelFromUserNameOrExternalId.calledWith(mockChannelId)
      .mockResolvedValue(cast<YoutubeChannel>({ id: youtubeChannelId, youtubeId: mockChannelId }))
    mockChannelStore.getYoutubeChannelsFromChannelIds.calledWith(expectArray([youtubeChannelId]))
      .mockResolvedValue([cast<UserChannel<'youtube'>>({ platformInfo: { platform: 'youtube', channel: { globalInfoHistory: [{ name: youtubeChannelName }]}} })])

    const result = await adminService.getYoutubeChannelName()

    expect(result).toBe(youtubeChannelName)
  })
})
