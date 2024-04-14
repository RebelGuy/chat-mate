import EmojiService from '@rebel/server/services/EmojiService'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { Dependencies } from '@rebel/shared/context/context'
import { cast, nameof } from '@rebel/shared/testUtils'
import { MockProxy, mock } from 'jest-mock-extended'

let mockRankStore: MockProxy<RankStore>
let emojiService: EmojiService

beforeEach(() => {
  mockRankStore = mock()

  emojiService = new EmojiService(new Dependencies({
    rankStore: mockRankStore
  }))
})

describe(nameof(EmojiService, 'getEligibleEmojiUsers'), () => {
  test('Returns the ids of users with donation ranks', async () => {
    const streamerId = 4
    mockRankStore.getUserRanksForGroup.calledWith('donation', streamerId).mockResolvedValue(cast<UserRankWithRelations[]>([{ primaryUserId: 1 }, { primaryUserId: 1 }, { primaryUserId: 2 }]))

    const result = await emojiService.getEligibleEmojiUsers(streamerId)

    expect(result).toEqual([1, 2])
  })
})
