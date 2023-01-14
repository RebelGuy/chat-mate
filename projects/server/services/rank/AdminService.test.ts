import { Rank } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import AdminService from '@rebel/server/services/rank/AdminService'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { cast, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

const primaryUser1 = 1
const primaryUser2 = 2
const primaryUser3 = 3

const adminRank = cast<Rank>({ name: 'admin' })
const modRank = cast<Rank>({ name: 'mod' })
const ownerRank = cast<Rank>({ name: 'owner' })

let mockRankStore: MockProxy<RankStore>
let adminService: AdminService

beforeEach(() => {
  mockRankStore = mock()

  adminService = new AdminService(new Dependencies({
    rankStore: mockRankStore
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
