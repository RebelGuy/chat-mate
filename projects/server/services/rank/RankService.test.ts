import { Rank } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import RankService from '@rebel/server/services/rank/RankService'
import RankStore from '@rebel/server/stores/RankStore'
import { cast, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockRankStore: MockProxy<RankStore>
let rankService: RankService

beforeEach(() => {
  mockRankStore = mock()
  rankService = new RankService(new Dependencies({
    rankStore: mockRankStore
  }))
})

describe(nameof(RankService, 'getAccessibleRanks'), () => {
  test('Returns Regular ranks', async () => {
    const ownerRank = cast<Rank>({ name: 'owner' })
    const famousRank = cast<Rank>({ name: 'famous' })
    const donatorRank = cast<Rank>({ name: 'donator' })
    const bannedRank = cast<Rank>({ name: 'ban' })
    mockRankStore.getRanks.mockResolvedValue([ownerRank, famousRank, donatorRank, bannedRank])
  
    const result = await rankService.getAccessibleRanks()

    expect(result).toEqual([famousRank, donatorRank])
  })
})
