import { CustomEmoji } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { Entity, New } from '@rebel/server/models/entities'
import { Db } from '@rebel/server/providers/DbProvider'
import CustomEmojiStore from '@rebel/server/stores/CustomEmojiStore'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { nameof } from '@rebel/server/_test/utils'

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
