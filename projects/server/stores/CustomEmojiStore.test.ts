import { CustomEmoji, CustomEmojiRankWhitelist, Prisma } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { Entity, New } from '@rebel/server/models/entities'
import { Db } from '@rebel/server/providers/DbProvider'
import CustomEmojiStore, { CustomEmojiCreateData, CustomEmojiUpdateData, CustomEmojiWhitelistedRanks, CustomEmojiWithRankWhitelist } from '@rebel/server/stores/CustomEmojiStore'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { expectArray, nameof } from '@rebel/server/_test/utils'

const rank1 = 1
const rank2 = 2
const rank3 = 3

export default () => {
  let customEmojiStore: CustomEmojiStore
  let db: Db

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    db = dbProvider.get()

    await db.rank.createMany({ data: [
      { name: 'donator', group: 'cosmetic', displayNameAdjective: 'rank1', displayNameNoun: 'rank1' },
      { name: 'supporter', group: 'cosmetic', displayNameAdjective: 'rank2', displayNameNoun: 'rank2' },
      { name: 'member', group: 'cosmetic', displayNameAdjective: 'rank3', displayNameNoun: 'rank3' },
    ]})

    customEmojiStore = new CustomEmojiStore(new Dependencies({ dbProvider }))
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(CustomEmojiStore, 'addCustomEmoji'), () => {
    test('custom emoji with no whitelisted ranks is added', async () => {
      const emoji = getEmojiObj(1)
      const data: CustomEmojiCreateData = { ...emoji, whitelistedRanks: [] }

      await customEmojiStore.addCustomEmoji(data)

      await expectRowCount(db.customEmoji).toBe(1)
      await expect(db.customEmoji.findFirst()).resolves.toEqual(expect.objectContaining(emoji))
    })

    test('custom emoji and whitelisted ranks are added', async () => {
      const emoji = getEmojiObj(1)
      const data: CustomEmojiCreateData = { ...emoji, whitelistedRanks: [rank1, rank2] }

      await customEmojiStore.addCustomEmoji(data)

      // verify that emoji is added
      await expectRowCount(db.customEmoji, db.customEmojiRankWhitelist).toEqual([1, 2])
      await expect(db.customEmoji.findFirst()).resolves.toEqual(expect.objectContaining(emoji))

      // verify that ranks are whitelisted
      const storedRankWhitelists = await db.customEmojiRankWhitelist.findMany()
      expect(storedRankWhitelists).toEqual<CustomEmojiRankWhitelist[]>([
        { id: 1, customEmojiId: 1, rankId: 1 },
        { id: 2, customEmojiId: 1, rankId: 2 }
      ])
    })

    test('duplicate symbol is rejected', async () => {
      await db.customEmoji.create({ data: getEmojiObj(1) })
      const data: CustomEmojiCreateData = { ...getEmojiObj(1), whitelistedRanks: [] }

      await expect(() => customEmojiStore.addCustomEmoji(data)).rejects.toThrowError()
    })
  })

  describe(nameof(CustomEmojiStore, 'getAllCustomEmojis'), () => {
    test('returns all custom emojis', async () => {
      const emoji1 = getEmojiObj(1)
      const emoji2 = getEmojiObj(2)
      const emoji3 = getEmojiObj(3)
      await db.customEmoji.createMany({ data: [emoji1, emoji2, emoji3] })
      await db.customEmojiRankWhitelist.createMany({ data: [
        { customEmojiId: 1, rankId: rank1 },
        { customEmojiId: 1, rankId: rank2 },
        { customEmojiId: 2, rankId: rank1 },
      ]})

      const result = await customEmojiStore.getAllCustomEmojis()

      expect(result.length).toBe(3)
      expect(result[0]).toEqual(expect.objectContaining<CustomEmojiWithRankWhitelist>({ ...emoji1, whitelistedRanks: [rank1, rank2] }))
      expect(result[1]).toEqual(expect.objectContaining<CustomEmojiWithRankWhitelist>({ ...emoji2, whitelistedRanks: [rank1] }))
      expect(result[2]).toEqual(expect.objectContaining<CustomEmojiWithRankWhitelist>({ ...emoji3, whitelistedRanks: [] }))
    })
  })

  describe(nameof(CustomEmojiStore, 'getCustomEmojiWhitelistedRanks'), () => {
    test('returns the rank whitelist for each specified emoji', async () => {
      const emoji1 = getEmojiObj(1)
      const emoji2 = getEmojiObj(2)
      const emoji3 = getEmojiObj(3)
      const emoji4 = getEmojiObj(4)
      await db.customEmoji.createMany({ data: [emoji1, emoji2, emoji3, emoji4] })
      await db.customEmojiRankWhitelist.createMany({ data: [
        { customEmojiId: 1, rankId: 1 },
        { customEmojiId: 1, rankId: 2 },
        { customEmojiId: 2, rankId: 1 },
        { customEmojiId: 4, rankId: 1 },
      ]})

      const result = await customEmojiStore.getCustomEmojiWhitelistedRanks([2, 1, 3])

      expect(result.length).toBe(3)
      expect(result[0]).toEqual<CustomEmojiWhitelistedRanks>({ emojiId: 2, rankIds: [1] })
      expect(result[1]).toEqual<CustomEmojiWhitelistedRanks>({ emojiId: 1, rankIds: [1, 2] })
      expect(result[2]).toEqual<CustomEmojiWhitelistedRanks>({ emojiId: 3, rankIds: [] })
    })
  })

  describe(nameof(CustomEmojiStore, 'updateCustomEmoji'), () => {
    test('updates the custom emoji correctly', async () => {
      const existingEmoji = getEmojiObj(1)
      await db.customEmoji.create({ data: existingEmoji })
      await db.customEmojiRankWhitelist.createMany({ data: [
        { customEmojiId: 1, rankId: 1 },
        { customEmojiId: 1, rankId: 2 }
      ]})
      const updatedEmoji = { ...getEmojiObj(2), id: existingEmoji.id }
      const data: CustomEmojiUpdateData = { ...updatedEmoji, whitelistedRanks: [rank2, rank3] }

      const result = await customEmojiStore.updateCustomEmoji(data)

      expect(result).toEqual<CustomEmojiWithRankWhitelist>(data)
      await expectRowCount(db.customEmoji).toBe(1)
      await expect(db.customEmoji.findFirst()).resolves.toEqual(expect.objectContaining<CustomEmoji>(updatedEmoji))

      // ensure rank whitelists were updated - rank1 should have been removed, and rank3 should have been added
      await expectRowCount(db.customEmojiRankWhitelist).toBe(2)
      const [whitelist1, whitelist2] = await db.customEmojiRankWhitelist.findMany()
      expect(whitelist1).toEqual<CustomEmojiRankWhitelist>({ id: 2, customEmojiId: updatedEmoji.id, rankId: rank2 })
      expect(whitelist2).toEqual<CustomEmojiRankWhitelist>({ id: 3, customEmojiId: updatedEmoji.id, rankId: rank3 })
    })

    test('throws if invalid id', async () => {
      await db.customEmoji.create({ data: getEmojiObj(1) })

      await expect(() => customEmojiStore.updateCustomEmoji({ ...getEmojiObj(2), whitelistedRanks: [] })).rejects.toThrow()
    })
  })
}

function getEmojiObj (id: number): CustomEmoji {
  return {
    id: id,
    name: 'Emoji ' + id,
    symbol: 'emoji' + id,
    image: Buffer.from('emoji' + id),
    levelRequirement: id
  }
}
