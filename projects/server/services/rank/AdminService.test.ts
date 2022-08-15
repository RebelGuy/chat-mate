import { Rank } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import AdminService from '@rebel/server/services/rank/AdminService'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { cast, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

const user1 = 1
const user2 = 2
const user3 = 3

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
    mockRankStore.getUserRanksForGroup.calledWith('administration').mockResolvedValue(cast<UserRankWithRelations[]>([
      { userId: user1, rank: modRank },
      { userId: user1, rank: adminRank },
      { userId: user2, rank: ownerRank },
      { userId: user2, rank: adminRank },
      { userId: user3, rank: ownerRank },
      { userId: user3, rank: modRank }
    ]))

    const result = await adminService.getAdminUsers()

    expect(result.map(r => r.id)).toEqual([user1, user2])
  })
})
