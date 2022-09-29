import { Dependencies } from '@rebel/server/context/context'
import { Entity } from '@rebel/server/models/entities'
import CustomEmojiEligibilityService from '@rebel/server/services/CustomEmojiEligibilityService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import CustomEmojiStore from '@rebel/server/stores/CustomEmojiStore'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { cast, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'
import { asGte, asLte } from '@rebel/server/util/math'
import { Rank } from '@prisma/client'
import { expectArray } from '@rebel/server/_test/utils'

const userId = 1
const customEmoji1: Entity.CustomEmoji = { id: 1, name: 'Emoji 1', symbol: 'emoji1', levelRequirement: 10, image: Buffer.from('') }
const customEmoji2: Entity.CustomEmoji = { id: 2, name: 'Emoji 2', symbol: 'emoji2', levelRequirement: 20, image: Buffer.from('') }
const customEmoji3: Entity.CustomEmoji = { id: 3, name: 'Emoji 3', symbol: 'emoji3', levelRequirement: 30, image: Buffer.from('') }

const rank1 = cast<Rank>({ id: 1 })
const rank2 = cast<Rank>({ id: 2 })
const rank3 = cast<Rank>({ id: 3 })

let mockCustomEmojiStore: MockProxy<CustomEmojiStore>
let mockExperienceService: MockProxy<ExperienceService>
let mockRankStore: MockProxy<RankStore>
let customEmojiEligibilityService: CustomEmojiEligibilityService

beforeEach(() => {
  mockCustomEmojiStore = mock()
  mockExperienceService = mock()
  mockRankStore = mock()

  customEmojiEligibilityService = new CustomEmojiEligibilityService(new Dependencies({
    customEmojiStore: mockCustomEmojiStore,
    experienceService: mockExperienceService,
    rankStore: mockRankStore
  }))
})

describe(nameof(CustomEmojiEligibilityService, 'getEligibleEmojis'), () => {
  test('low-levelled user does not match emojis', async () => {
    setupCustomEmojis([customEmoji1, []]) // no whitelist
    setupLevel(0)
    setupUserRanks() // no ranks

    const result = await customEmojiEligibilityService.getEligibleEmojis(userId)

    expect(result.length).toBe(0)
  })

  test('high-levelled player matches emojis', async () => {
    setupCustomEmojis([customEmoji1, []], [customEmoji2, []], [customEmoji3, []]) // no whitelist
    setupLevel(25)
    setupUserRanks() // no ranks

    const result = await customEmojiEligibilityService.getEligibleEmojis(userId)

    expect(result.length).toBe(2)
    expect(result[0].id).toBe(customEmoji1.id)
    expect(result[1].id).toBe(customEmoji2.id)
  })

  test('user without required rank (but sufficient level) does not match emoji', async () => {
    setupCustomEmojis([customEmoji1, [rank2]], [customEmoji2, [rank2, rank3]], [customEmoji3, [rank3]])
    setupLevel(100)
    setupUserRanks(rank1)

    const result = await customEmojiEligibilityService.getEligibleEmojis(userId)

    expect(result.length).toBe(0)
  })

  test('user with all or partial required ranks matches emojis', async () => {
    setupCustomEmojis([customEmoji1, [rank1]], [customEmoji2, [rank2, rank3]], [customEmoji3, [rank3]])
    setupLevel(100)
    setupUserRanks(rank1, rank2)

    const result = await customEmojiEligibilityService.getEligibleEmojis(userId)

    expect(result.length).toBe(2)
    expect(result[0].id).toBe(customEmoji1.id)
    expect(result[1].id).toBe(customEmoji2.id)
  })

  test('user with insufficient level but sufficient ranks does not match emoji', async () => {
    setupCustomEmojis([customEmoji1, [rank1]])
    setupLevel(1)
    setupUserRanks(rank1)

    const result = await customEmojiEligibilityService.getEligibleEmojis(userId)

    expect(result.length).toBe(0)
  })
})

/** Setup all emojis and their rank whitelist */
function setupCustomEmojis (...whitelist: [Entity.CustomEmoji, Rank[]][]) {
  mockCustomEmojiStore.getAllCustomEmojis.mockResolvedValue(whitelist.map(w => ({
    ...w[0],
    whitelistedRanks: w[1].map(r => r.id)
  })))

  mockCustomEmojiStore.getCustomEmojiWhitelistedRanks.mockReset()
    .calledWith(expectArray<number>(whitelist.map(w => w[0].id)))
    .mockResolvedValue(whitelist.map(w => ({
      emojiId: w[0].id,
      rankIds: w[1].map(r => r.id)
    })))
}

function setupLevel (level: number) {
  mockExperienceService.getLevels
    .calledWith(expect.arrayContaining([userId]))
    .mockResolvedValue([{
      userId: userId,
      level: { level: asGte(level, 0), levelProgress: asLte(0, 1), totalExperience: 0 }
    }])
}

function setupUserRanks (...ranks: Rank[]) {
  mockRankStore.getUserRanks
    .calledWith(expectArray<number>([userId]))
    .mockResolvedValue([{
      userId,
      ranks: ranks.map(r => cast<UserRankWithRelations>({ rank: r }))
    }])
}