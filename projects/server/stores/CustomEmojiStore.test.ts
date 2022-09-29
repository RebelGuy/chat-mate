import { CustomEmoji } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { Entity, New } from '@rebel/server/models/entities'
import { Db } from '@rebel/server/providers/DbProvider'
import CustomEmojiStore, { EmojiRankWhitelist } from '@rebel/server/stores/CustomEmojiStore'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { expectArray, nameof } from '@rebel/server/_test/utils'

const emoji1: New<Entity.CustomEmoji> = {
  name: 'Emoji 1',
  symbol: 'emoji1',
  image: Buffer.from('emoji1'),
  levelRequirement: 10
}
const emoji2: New<Entity.CustomEmoji> = {
  name: 'Emoji 2',
  symbol: 'emoji2',
  image: Buffer.from('emoji2'),
  levelRequirement: 20
}
const emoji3: New<Entity.CustomEmoji> = {
  name: 'Emoji 3',
  symbol: 'emoji3',
  image: Buffer.from('emoji3'),
  levelRequirement: 30
}
const emoji4: New<Entity.CustomEmoji> = {
  name: 'Emoji 4',
  symbol: 'emoji4',
  image: Buffer.from('emoji4'),
  levelRequirement: 40
}

export default () => {
  let customEmojiStore: CustomEmojiStore
  let db: Db

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    customEmojiStore = new CustomEmojiStore(new Dependencies({ dbProvider }))
    db = dbProvider.get()
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(CustomEmojiStore, 'addCustomEmoji'), () => {
    test('custom emoji is added', async () => {
      await customEmojiStore.addCustomEmoji(emoji1)

      expectRowCount(db.customEmoji).toBe(1)
      await expect(db.customEmoji.findFirst()).resolves.toEqual(expect.objectContaining(emoji1))
    })

    test('duplicate symbol is rejected', async () => {
      await db.customEmoji.create({ data: emoji1 })

      await expect(() => customEmojiStore.addCustomEmoji(emoji1)).rejects.toThrowError()
    })
  })

  describe(nameof(CustomEmojiStore, 'getAllCustomEmojis'), () => {
    test('returns all custom emojis', async () => {
      await db.customEmoji.createMany({ data: [emoji1, emoji2] })

      const result = await customEmojiStore.getAllCustomEmojis()

      expect(result.length).toBe(2)
      expect(result[0]).toEqual(expect.objectContaining(emoji1))
      expect(result[1]).toEqual(expect.objectContaining(emoji2))
    })
  })

  describe(nameof(CustomEmojiStore, 'getCustomEmojiWhitelistedRanks'), () => {
    test('returns the rank whitelist for each specified emoji', async () => {
      await db.customEmoji.createMany({ data: [emoji1, emoji2, emoji3, emoji4] })
      await db.rank.createMany({ data: [
        { name: 'donator', group: 'cosmetic', displayNameAdjective: 'rank1', displayNameNoun: 'rank2' },
        { name: 'supporter', group: 'cosmetic', displayNameAdjective: 'rank2', displayNameNoun: 'rank2' }
      ]})
      await db.customEmojiRankWhitelist.createMany({ data: [
        { customEmojiId: 1, rankId: 1 },
        { customEmojiId: 1, rankId: 2 },
        { customEmojiId: 2, rankId: 1 },
        { customEmojiId: 4, rankId: 1 },
      ]})

      const result = await customEmojiStore.getCustomEmojiWhitelistedRanks([2, 1, 3])

      expect(result.length).toBe(3)
      expect(result[0]).toEqual<EmojiRankWhitelist>({ emojiId: 2, rankIds: [1] })
      expect(result[1]).toEqual<EmojiRankWhitelist>({ emojiId: 1, rankIds: [1, 2] })
      expect(result[2]).toEqual<EmojiRankWhitelist>({ emojiId: 3, rankIds: [] })
    })
  })

  describe(nameof(CustomEmojiStore, 'updateCustomEmoji'), () => {
    test('updates the custom emoji correctly', async () => {
      const old = await db.customEmoji.create({ data: emoji1 })
      const newEmoji = { id: old.id, ...emoji2 }

      const result = await customEmojiStore.updateCustomEmoji(newEmoji)

      expect(result).toEqual(newEmoji)
      expectRowCount(db.customEmoji).toBe(1)
      await expect(db.customEmoji.findFirst()).resolves.toEqual(newEmoji)
    })

    test('throws if invalid id', async () => {
      await db.customEmoji.create({ data: emoji1 })

      await expect(() => customEmojiStore.updateCustomEmoji({ id: 2, ...emoji2 })).rejects.toThrow()
    })
  })
}
