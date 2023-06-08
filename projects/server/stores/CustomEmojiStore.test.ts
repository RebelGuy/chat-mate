import { CustomEmoji, CustomEmojiRankWhitelist, CustomEmojiVersion, Prisma } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import { Entity, New } from '@rebel/server/models/entities'
import { Db } from '@rebel/server/providers/DbProvider'
import CustomEmojiStore, { CustomEmojiCreateData, CustomEmojiUpdateData, CustomEmojiWhitelistedRanks, CustomEmojiWithRankWhitelist } from '@rebel/server/stores/CustomEmojiStore'
import { sortBy } from '@rebel/shared/util/arrays'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { anyDate, expectArray, expectObject, nameof } from '@rebel/shared/testUtils'
import { symbolName } from 'typescript'

type EmojiData = Pick<CustomEmoji, 'id' | 'symbol'> & Pick<CustomEmojiVersion, 'image' | 'levelRequirement' | 'name'>

const rank1 = 1
const rank2 = 2
const rank3 = 3

const streamer1 = 1
const streamer2 = 2

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
    await db.streamer.create({ data: {
      registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}
    }})
    await db.streamer.create({ data: {
      registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }}
    }})

    customEmojiStore = new CustomEmojiStore(new Dependencies({ dbProvider }))
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(CustomEmojiStore, 'addCustomEmoji'), () => {
    test('custom emoji with no whitelisted ranks is added', async () => {
      const data = getEmojiCreateData(1)

      await customEmojiStore.addCustomEmoji({ ...data, whitelistedRanks: [] })

      await expectRowCount(db.customEmoji).toBe(1)
      await expect(db.customEmoji.findFirst()).resolves.toEqual(expectObject<CustomEmoji>({ symbol: data.symbol, streamerId: data.streamerId }))
      await expect(db.customEmojiVersion.findFirst()).resolves.toEqual(expectObject<CustomEmojiVersion>({ name: data.name }))
    })

    test('symbols must be unique only for the given streamer', async () => {
      const symbol = 'symbol'
      await db.customEmoji.create({ data: { symbol: symbol, streamerId: streamer1 }})
      const data = { ...getEmojiCreateData(1, streamer2), symbol: symbol }

      await customEmojiStore.addCustomEmoji({ ...data, whitelistedRanks: [] })

      await expectRowCount(db.customEmoji).toBe(2)
      await expect(db.customEmoji.findFirst({ where: { streamerId: streamer2 }})).resolves.toEqual(expectObject<CustomEmoji>({ symbol: data.symbol, streamerId: data.streamerId }))
      await expect(db.customEmojiVersion.findFirst()).resolves.toEqual(expectObject<CustomEmojiVersion>({ name: data.name }))
    })

    test('custom emoji and whitelisted ranks are added', async () => {
      const data = { ...getEmojiCreateData(1), whitelistedRanks: [rank1, rank2] }

      await customEmojiStore.addCustomEmoji(data)

      // verify that emoji is added
      await expectRowCount(db.customEmoji, db.customEmojiRankWhitelist).toEqual([1, 2])
      await expect(db.customEmoji.findFirst()).resolves.toEqual(expectObject<CustomEmoji>({ symbol: data.symbol, streamerId: data.streamerId }))
      await expect(db.customEmojiVersion.findFirst()).resolves.toEqual(expectObject<CustomEmojiVersion>({ name: data.name }))

      // verify that ranks are whitelisted
      const storedRankWhitelists = await db.customEmojiRankWhitelist.findMany()
      expect(storedRankWhitelists).toEqual<CustomEmojiRankWhitelist[]>([
        { id: 1, customEmojiId: 1, rankId: 1 },
        { id: 2, customEmojiId: 1, rankId: 2 }
      ])
    })

    test('duplicate symbol is rejected', async () => {
      await db.customEmoji.create({ data: { streamerId: streamer1, symbol: 'emoji1' } })
      const data: CustomEmojiCreateData = { ...getEmojiCreateData(1), whitelistedRanks: [] }

      await expect(() => customEmojiStore.addCustomEmoji(data)).rejects.toThrowError()
    })
  })

  describe(nameof(CustomEmojiStore, 'getAllCustomEmojis'), () => {
    test('returns all custom emojis for the streamer', async () => {
      await createEmojis([1, 2, 3, 4], [streamer1, streamer1, streamer1, streamer2])
      await db.customEmojiRankWhitelist.createMany({ data: [
        { customEmojiId: 1, rankId: rank1 },
        { customEmojiId: 1, rankId: rank2 },
        { customEmojiId: 2, rankId: rank1 },
      ]})

      const result = await customEmojiStore.getAllCustomEmojis(streamer1)

      expect(result.length).toBe(3)
      expect(result[0]).toEqual(expectObject<CustomEmojiWithRankWhitelist>({ id: 1, whitelistedRanks: [rank1, rank2] }))
      expect(result[1]).toEqual(expectObject<CustomEmojiWithRankWhitelist>({ id: 2, whitelistedRanks: [rank1] }))
      expect(result[2]).toEqual(expectObject<CustomEmojiWithRankWhitelist>({ id: 3, whitelistedRanks: [] }))
    })

    test('does not return deactivated emojis', async () => {
      await db.customEmojiVersion.create({ data: {
        customEmoji: { create: { streamerId: streamer1, symbol: 'symbol' }},
        image: Buffer.from('emoji'),
        isActive: false,
        levelRequirement: 1,
        canUseInDonationMessage: true,
        name: 'Emoji',
        version: 0
      }})

      const result = await customEmojiStore.getAllCustomEmojis(streamer1)

      expect(result.length).toBe(0)
    })
  })

  describe(nameof(CustomEmojiStore, 'getCustomEmojiWhitelistedRanks'), () => {
    test('returns the rank whitelist for each specified emoji', async () => {
      await createEmojis([1, 2, 3, 4])
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
      const emojiToUpdate = 1
      const otherEmoji = 2
      await createEmojis([emojiToUpdate, otherEmoji])
      await db.customEmojiRankWhitelist.createMany({ data: [
        { customEmojiId: emojiToUpdate, rankId: 1 },
        { customEmojiId: emojiToUpdate, rankId: 2 },
        { customEmojiId: otherEmoji, rankId: 1 },
        { customEmojiId: otherEmoji, rankId: 2 }
      ]})
      const data: CustomEmojiUpdateData = {
        id: emojiToUpdate,
        name: 'Test',
        image: Buffer.from(''),
        levelRequirement: 1,
        canUseInDonationMessage: true,
        whitelistedRanks: [rank2, rank3]
      }

      const result = await customEmojiStore.updateCustomEmoji(data)

      expect(result).toEqual(expectObject<CustomEmojiWithRankWhitelist>(data))
      await expectRowCount(db.customEmoji).toBe(2)
      await expectRowCount(db.customEmojiVersion).toBe(3)
      const [oldVersion, otherVersion, newVersion] = await db.customEmojiVersion.findMany()
      expect(oldVersion).toEqual(expectObject<CustomEmojiVersion>({ customEmojiId: emojiToUpdate, isActive: false, version: 0 }))
      expect(otherVersion).toEqual(expectObject<CustomEmojiVersion>({ customEmojiId: otherEmoji, isActive: true, version: 0 }))
      expect(newVersion).toEqual(expectObject<CustomEmojiVersion>({ customEmojiId: emojiToUpdate, isActive: true, version: 1 }))

      // ensure rank whitelists were updated - rank1 should have been removed, and rank3 should have been added.
      // the other two whitelist entries should have remained unchanged.
      await expectRowCount(db.customEmojiRankWhitelist).toBe(4)
      const [whitelist1, whitelist2, whitelist3, whitelist4] = sortBy(await db.customEmojiRankWhitelist.findMany(), x => x.id)
      expect(whitelist1).toEqual<CustomEmojiRankWhitelist>({ id: 2, customEmojiId: emojiToUpdate, rankId: rank2 })
      expect(whitelist2).toEqual<CustomEmojiRankWhitelist>({ id: 3, customEmojiId: otherEmoji, rankId: rank1 })
      expect(whitelist3).toEqual<CustomEmojiRankWhitelist>({ id: 4, customEmojiId: otherEmoji, rankId: rank2 })
      expect(whitelist4).toEqual<CustomEmojiRankWhitelist>({ id: 5, customEmojiId: emojiToUpdate, rankId: rank3 })
    })

    test('throws if invalid id', async () => {
      await createEmojis([1])

      await expect(() => customEmojiStore.updateCustomEmoji({ id: 2 } as any)).rejects.toThrow()
    })

    test('throws if attempting to update a deactivated emoji', async () => {
      await createEmojis([1])
      db.customEmojiVersion.updateMany({ data: { isActive: false }})

      await expect(() => customEmojiStore.updateCustomEmoji({ id: 1 } as any)).rejects.toThrow()
    })
  })

  describe('integration tests', () => {
    test('TRG_CHECK_EXISTING_ACTIVE_VERSION prevents multiple active versions', async () => {
      await createEmojis([1])

      await expect(() => db.customEmojiVersion.create({ data: {
        customEmojiId: 1,
        isActive: true,
        image: Buffer.from(''),
        name: 'Test,',
        levelRequirement: 1,
        canUseInDonationMessage: true,
        version: 1
      }})).rejects.toThrow()
    })
  })

  async function createEmojis (ids: number[], streamerIds?: number[]) {
    await db.customEmoji.createMany({ data: ids.map((id, i) => ({ id, symbol: 'emoji' + id, streamerId: streamerIds?.at(i) ?? streamer1 }))})
    await db.customEmojiVersion.createMany({ data: ids.map(id => ({
      customEmojiId: id,
      image: Buffer.from('emoji' + id),
      isActive: true,
      levelRequirement: id,
      canUseInDonationMessage: true,
      name: 'Emoji ' + id,
      version: 0
    }))})
  }
}

function getEmojiCreateData (id: number, streamerId?: number): Omit<CustomEmojiCreateData, 'whitelistedRanks'> {
  return {
    name: 'Emoji ' + id,
    streamerId: streamerId ?? streamer1,
    symbol: 'emoji' + id,
    image: Buffer.from('emoji' + id),
    levelRequirement: id,
    canUseInDonationMessage: true
  }
}
