import { CustomEmoji, CustomEmojiRankWhitelist, CustomEmojiVersion } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import CustomEmojiStore, { InternalCustomEmojiCreateData, InternalCustomEmojiUpdateData, CustomEmojiWhitelistedRanks, CustomEmojiWithRankWhitelist } from '@rebel/server/stores/CustomEmojiStore'
import { single, sortBy } from '@rebel/shared/util/arrays'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { expectObject, nameof, promised, throwAsync } from '@rebel/shared/testUtils'
import { ChatMateError, DbError, NotFoundError } from '@rebel/shared/util/error'
import { SafeOmit } from '@rebel/shared/types'
import { mock } from 'jest-mock-extended'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'
import { GroupedSemaphore } from '@rebel/shared/util/Semaphore'
import { ImageInfo } from '@rebel/server/services/ImageService'

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

    const chatMateStateService = mock<ChatMateStateService>({ getCustomEmojiSemaphore: () => new GroupedSemaphore(1) })

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

    customEmojiStore = new CustomEmojiStore(new Dependencies({ dbProvider, chatMateStateService }))
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(CustomEmojiStore, 'getCustomEmojiById'), () => {
    test('Returns the specified emoji', async () => {
      await createEmojis([1, 2], [streamer1, streamer2])

      const result = await customEmojiStore.getCustomEmojiById(2)

      expect(result).toEqual<CustomEmoji>({ id: 2, sortOrder: 2, streamerId: streamer2, symbol: 'emoji2', deletedAt: null })
    })

    test(`Returns null if the specified emoji doesn't exist`, async () => {
      await createEmojis([1])

      const result = await customEmojiStore.getCustomEmojiById(2)

      expect(result).toBeNull()
    })

    test('Returns null if the specified emoji is deactivated', async () => {
      await createEmojis([1, 2], [streamer1, streamer2])
      await db.customEmoji.update({ where: { id: 2 }, data: { deletedAt: new Date() }})

      const result = await customEmojiStore.getCustomEmojiById(2)

      expect(result).toBeNull()
    })
  })

  describe(nameof(CustomEmojiStore, 'addCustomEmoji'), () => {
    test('custom emoji with no whitelisted ranks is added and the imageUrl is set correctly', async () => {
      const data = getEmojiCreateData(1)
      const imageInfo: ImageInfo = {
        relativeImageUrl: 'url',
        imageWidth: 100,
        imageHeight: 200
      }

      await customEmojiStore.addCustomEmoji({ ...data, whitelistedRanks: [] }, () => promised(imageInfo))

      await expectRowCount(db.customEmoji).toBe(1)
      await expect(db.customEmoji.findFirst()).resolves.toEqual(expectObject<CustomEmoji>({ symbol: data.symbol, streamerId: data.streamerId }))
      await expect(db.customEmojiVersion.findFirst()).resolves.toEqual(expectObject<CustomEmojiVersion>({ name: data.name }))

      const image = single(await db.image.findMany())
      expect(image).toEqual(expectObject(image, { url: imageInfo.relativeImageUrl, width: imageInfo.imageWidth, height: imageInfo.imageHeight }))
    })

    test('symbols must be unique only for the given streamer', async () => {
      const symbol = 'symbol'
      await db.customEmoji.create({ data: { symbol: symbol, streamerId: streamer1, sortOrder: 1 }})
      const data = { ...getEmojiCreateData(1, streamer2), symbol: symbol }
      const imageInfo: ImageInfo = {
        relativeImageUrl: 'url',
        imageWidth: 100,
        imageHeight: 200
      }

      await customEmojiStore.addCustomEmoji({ ...data, whitelistedRanks: [] }, () => promised(imageInfo))

      await expectRowCount(db.customEmoji).toBe(2)
      await expect(db.customEmoji.findFirst({ where: { streamerId: streamer2 }})).resolves.toEqual(expectObject<CustomEmoji>({ symbol: data.symbol, streamerId: data.streamerId }))
      await expect(db.customEmojiVersion.findFirst()).resolves.toEqual(expectObject<CustomEmojiVersion>({ name: data.name }))

      const image = single(await db.image.findMany())
      expect(image).toEqual(expectObject(image, { url: imageInfo.relativeImageUrl, width: imageInfo.imageWidth, height: imageInfo.imageHeight }))
    })

    test('custom emoji and whitelisted ranks are added', async () => {
      const data = { ...getEmojiCreateData(1), whitelistedRanks: [rank1, rank2] }
      const imageInfo: ImageInfo = {
        relativeImageUrl: 'url',
        imageWidth: 100,
        imageHeight: 200
      }

      await customEmojiStore.addCustomEmoji(data, () => promised(imageInfo))

      // verify that emoji is added
      await expectRowCount(db.customEmoji, db.customEmojiRankWhitelist).toEqual([1, 2])
      await expect(db.customEmoji.findFirst()).resolves.toEqual(expectObject<CustomEmoji>({ symbol: data.symbol, streamerId: data.streamerId }))
      await expect(db.customEmojiVersion.findFirst()).resolves.toEqual(expectObject<CustomEmojiVersion>({ name: data.name }))

      const image = single(await db.image.findMany())
      expect(image).toEqual(expectObject(image, { url: imageInfo.relativeImageUrl, width: imageInfo.imageWidth, height: imageInfo.imageHeight }))

      // verify that ranks are whitelisted
      const storedRankWhitelists = await db.customEmojiRankWhitelist.findMany()
      expect(storedRankWhitelists).toEqual<CustomEmojiRankWhitelist[]>([
        { id: 1, customEmojiVersionId: 1, rankId: 1 },
        { id: 2, customEmojiVersionId: 1, rankId: 2 }
      ])
    })

    test('duplicate symbol is rejected', async () => {
      await db.customEmoji.create({ data: { streamerId: streamer1, symbol: 'emoji1', sortOrder: 1 } })
      const data: InternalCustomEmojiCreateData = { ...getEmojiCreateData(1), whitelistedRanks: [] }

      await expect(() => customEmojiStore.addCustomEmoji(data, throwAsync)).rejects.toThrowError(DbError)
    })
  })

  describe(nameof(CustomEmojiStore, 'getAllCustomEmojis'), () => {
    test('returns all custom emojis for the streamer', async () => {
      await createEmojis([1, 2, 3, 4], [streamer1, streamer1, streamer1, streamer2])
      await db.customEmojiRankWhitelist.createMany({ data: [
        { customEmojiVersionId: 1, rankId: rank1 },
        { customEmojiVersionId: 1, rankId: rank2 },
        { customEmojiVersionId: 2, rankId: rank1 },
      ]})

      const result = await customEmojiStore.getAllCustomEmojis(streamer1)

      expect(result.length).toBe(3)
      expect(result[0]).toEqual(expectObject<CustomEmojiWithRankWhitelist>({ id: 1, whitelistedRanks: [rank1, rank2] }))
      expect(result[1]).toEqual(expectObject<CustomEmojiWithRankWhitelist>({ id: 2, whitelistedRanks: [rank1] }))
      expect(result[2]).toEqual(expectObject<CustomEmojiWithRankWhitelist>({ id: 3, whitelistedRanks: [] }))
    })

    test('does not return deactivated emojis', async () => {
      await db.customEmojiVersion.create({ data: {
        customEmoji: { create: { streamerId: streamer1, symbol: 'symbol', sortOrder: 1, deletedAt: new Date() }},
        levelRequirement: 1,
        canUseInDonationMessage: true,
        name: 'Emoji',
        version: 0,
        image: { create: {
          fingerprint: 'test',
          url: 'url',
          width: 100,
          height: 200
        }}
      }})

      const result = await customEmojiStore.getAllCustomEmojis(streamer1)

      expect(result.length).toBe(0)
    })

    test('returns the emoji with the latest version', async () => {
      await db.customEmojiVersion.create({ data: {
        customEmoji: { create: { streamerId: streamer1, symbol: 'symbol', sortOrder: 1 }},
        levelRequirement: 1,
        canUseInDonationMessage: true,
        name: 'Emoji',
        version: 0,
        image: { create: {
          fingerprint: 'test',
          url: 'url',
          width: 100,
          height: 200
        }}
      }})
      await db.customEmojiVersion.create({ data: {
        customEmoji: { connect: { id: 1 }},
        levelRequirement: 1,
        canUseInDonationMessage: true,
        name: 'Emoji',
        version: 1,
        image: { connect: { id: 1 }}
      }})

      const result = await customEmojiStore.getAllCustomEmojis(streamer1)

      expect(single(result).version).toBe(1)
    })
  })

  describe(nameof(CustomEmojiStore, 'deactivateCustomEmoji'), () => {
    test('Deactivates the currently active version of a custom emoji', async () => {
      await createEmojis([1, 2])

      await customEmojiStore.deactivateCustomEmoji(2)

      const result = await db.customEmoji.findMany()
      expect(result).toEqual(expectObject(result, [
        { id: 1, deletedAt: null }, // other emoji should still be active
        { id: 2, deletedAt: expect.any(Date) }
      ]))
    })
  })

  describe(nameof(CustomEmojiStore, 'getCustomEmojiWhitelistedRanks'), () => {
    test('returns the rank whitelist for each specified emoji', async () => {
      await createEmojis([1, 2, 3, 4, 5])
      await db.customEmojiRankWhitelist.createMany({ data: [
        { customEmojiVersionId: 1, rankId: 1 },
        { customEmojiVersionId: 1, rankId: 2 },
        { customEmojiVersionId: 2, rankId: 1 },
        { customEmojiVersionId: 4, rankId: 1 }, // deactivated
        { customEmojiVersionId: 5, rankId: 1 },
      ]})
      await db.customEmoji.update({ where: { id: 4 }, data: { deletedAt: new Date() } })

      const result = await customEmojiStore.getCustomEmojiWhitelistedRanks([2, 1, 3, 4])

      expect(result.length).toBe(4)
      expect(result[0]).toEqual<CustomEmojiWhitelistedRanks>({ emojiId: 2, rankIds: [1] })
      expect(result[1]).toEqual<CustomEmojiWhitelistedRanks>({ emojiId: 1, rankIds: [1, 2] })
      expect(result[2]).toEqual<CustomEmojiWhitelistedRanks>({ emojiId: 3, rankIds: [] })
      expect(result[3]).toEqual<CustomEmojiWhitelistedRanks>({ emojiId: 4, rankIds: [] }) // empty because deactivated
    })
  })

  describe(nameof(CustomEmojiStore, 'getEmojiIdFromStreamerSymbol'), () => {
    test('Returns the emoji id', async () => {
      await db.customEmoji.createMany({ data: [
        { symbol: 'emoji', streamerId: streamer1, sortOrder: 0 },
        { symbol: 'emoji', streamerId: streamer2, sortOrder: 0 }
      ]})

      const result = await customEmojiStore.getEmojiIdFromStreamerSymbol(streamer2, 'emoji')

      expect(result).toBe(2)
    })

    test('Returns null if the streamer symbol pair is not found', async () => {
      await db.customEmoji.createMany({ data: [
        { symbol: 'emoji', streamerId: streamer1, sortOrder: 0 },
        { symbol: 'abc', streamerId: streamer2, sortOrder: 0 }
      ]})

      const result = await customEmojiStore.getEmojiIdFromStreamerSymbol(streamer2, 'emoji')

      expect(result).toBeNull()
    })
  })

  describe(nameof(CustomEmojiStore, 'updateCustomEmoji'), () => {
    test('updates the custom emoji correctly', async () => {
      const emojiToUpdate = 1
      const otherEmoji = 2
      const imageInfo: ImageInfo = {
        relativeImageUrl: 'url',
        imageWidth: 100,
        imageHeight: 200
      }
      await createEmojis([emojiToUpdate, otherEmoji])
      await db.customEmojiRankWhitelist.createMany({ data: [
        { customEmojiVersionId: emojiToUpdate, rankId: 1 },
        { customEmojiVersionId: emojiToUpdate, rankId: 2 },
        { customEmojiVersionId: otherEmoji, rankId: 1 },
        { customEmojiVersionId: otherEmoji, rankId: 2 }
      ]})
      const data: InternalCustomEmojiUpdateData = {
        id: emojiToUpdate,
        name: 'Test',
        levelRequirement: 1,
        canUseInDonationMessage: true,
        whitelistedRanks: [rank2, rank3]
      }

      const result = await customEmojiStore.updateCustomEmoji(data, () => promised(imageInfo), false)

      expect(result).toEqual(expectObject<CustomEmojiWithRankWhitelist>(data))
      await expectRowCount(db.customEmoji).toBe(2)
      await expectRowCount(db.customEmojiVersion).toBe(3)
      const [oldVersion, otherVersion, newVersion] = await db.customEmojiVersion.findMany()
      expect(oldVersion).toEqual(expectObject<CustomEmojiVersion>({ customEmojiId: emojiToUpdate, version: 0 }))
      expect(otherVersion).toEqual(expectObject<CustomEmojiVersion>({ customEmojiId: otherEmoji, version: 0 }))
      expect(newVersion).toEqual(expectObject<CustomEmojiVersion>({ customEmojiId: emojiToUpdate, version: 1 }))

      // id = 3 since this is the third emoji version, and each emoji version is attached to one image
      const image = await db.image.findFirst({ where: { id: 3 }})
      expect(image).toEqual(expectObject(image, { url: imageInfo.relativeImageUrl, width: imageInfo.imageWidth, height: imageInfo.imageHeight }))

      // ensure rank whitelists were updated - rank1 should have been removed, and rank3 should have been added.
      // the other two whitelist entries should have remained unchanged.
      await expectRowCount(db.customEmojiRankWhitelist).toBe(6)
      const [whitelist1, whitelist2, whitelist3, whitelist4, whitelist5, whitelist6] = sortBy(await db.customEmojiRankWhitelist.findMany(), x => x.id)
      expect(whitelist1).toEqual<CustomEmojiRankWhitelist>({ id: 1, customEmojiVersionId: oldVersion.id, rankId: rank1 })
      expect(whitelist2).toEqual<CustomEmojiRankWhitelist>({ id: 2, customEmojiVersionId: oldVersion.id, rankId: rank2 })
      expect(whitelist3).toEqual<CustomEmojiRankWhitelist>({ id: 3, customEmojiVersionId: otherVersion.id, rankId: rank1 })
      expect(whitelist4).toEqual<CustomEmojiRankWhitelist>({ id: 4, customEmojiVersionId: otherVersion.id, rankId: rank2 })
      expect(whitelist5).toEqual<CustomEmojiRankWhitelist>({ id: 5, customEmojiVersionId: newVersion.id, rankId: rank2 })
      expect(whitelist6).toEqual<CustomEmojiRankWhitelist>({ id: 6, customEmojiVersionId: newVersion.id, rankId: rank3 })
    })

    test('Updates the deactivated custom emoji with allowDeactivated = true and reactivates the emoji', async () => {
      const emojiToUpdate = 1
      const imageInfo: ImageInfo = {
        relativeImageUrl: 'url',
        imageWidth: 100,
        imageHeight: 200
      }
      await createEmojis([emojiToUpdate])
      await db.customEmoji.update({ where: { id: emojiToUpdate }, data: { deletedAt: new Date() }})
      const data: InternalCustomEmojiUpdateData = {
        id: emojiToUpdate,
        name: 'Test',
        levelRequirement: 1,
        canUseInDonationMessage: true,
        whitelistedRanks: [rank2, rank3]
      }

      const result = await customEmojiStore.updateCustomEmoji(data, () => promised(imageInfo), true)

      expect(result).toEqual(expectObject<CustomEmojiWithRankWhitelist>(data))
      await expectRowCount(db.customEmojiVersion).toBe(2)

      const storedEmoji = await db.customEmoji.findUniqueOrThrow({ where: { id: emojiToUpdate }})
      expect(storedEmoji.deletedAt).toBeNull()

      const image = await db.image.findFirst({ where: { id: 2 }})
      expect(image).toEqual(expectObject(image, { url: imageInfo.relativeImageUrl, width: imageInfo.imageWidth, height: imageInfo.imageHeight }))
    })

    test('throws if invalid id', async () => {
      await createEmojis([1])

      await expect(() => customEmojiStore.updateCustomEmoji({ id: 2 } as any, throwAsync, false)).rejects.toThrowError(ChatMateError)
    })

    test('throws if attempting to update a deactivated emoji with allowDeactivated = false', async () => {
      await createEmojis([1])
      await db.customEmoji.update({ where: { id: 1 }, data: { deletedAt: new Date() }})

      await expect(() => customEmojiStore.updateCustomEmoji({ id: 1 } as any, throwAsync, false)).rejects.toThrowError(NotFoundError)
    })
  })

  describe(nameof(CustomEmojiStore, 'updateCustomEmojiSortOrders'), () => {
    test('Updates the custom emoji ids', async () => {
      await db.customEmoji.createMany({ data: [
        { streamerId: streamer1, sortOrder: 1, symbol: 'symbol1' },
        { streamerId: streamer1, sortOrder: 2, symbol: 'symbol2' },
        { streamerId: streamer1, sortOrder: 3, symbol: 'symbol3' },
        { streamerId: streamer1, sortOrder: 4, symbol: 'symbol4' },
        { streamerId: streamer1, sortOrder: 5, symbol: 'symbol5' }
      ]})

      await customEmojiStore.updateCustomEmojiSortOrders([2, 3, 5], [200, 300, 500])

      const stored = await db.customEmoji.findMany()
      expect(stored).toEqual(expectObject(stored, [
        { id: 1, sortOrder: 1 },
        { id: 2, sortOrder: 200 },
        { id: 3, sortOrder: 300 },
        { id: 4, sortOrder: 4 },
        { id: 5, sortOrder: 500 }
      ]))
    })

    test('Throws if the input is invalid', async () => {
      await expect(() => customEmojiStore.updateCustomEmojiSortOrders(['test' as any], [])).rejects.toThrowError(ChatMateError)
    })
  })

  async function createEmojis (ids: number[], streamerIds?: number[]) {
    await db.customEmoji.createMany({ data: ids.map((id, i) => ({ id, symbol: 'emoji' + id, streamerId: streamerIds?.at(i) ?? streamer1, sortOrder: id }))})
    await db.image.createMany({ data: ids.map(id => ({ fingerprint: `emoji/${id}`, url: 'url' + id, width: id * 10, height: id * 100 }))})
    await db.customEmojiVersion.createMany({ data: ids.map((id, i) => ({
      customEmojiId: id,
      levelRequirement: id,
      canUseInDonationMessage: true,
      name: 'Emoji ' + id,
      version: 0,
      imageId: i + 1
    }))})
  }
}

function getEmojiCreateData (id: number, streamerId?: number): SafeOmit<InternalCustomEmojiCreateData, 'whitelistedRanks'> {
  return {
    name: 'Emoji ' + id,
    streamerId: streamerId ?? streamer1,
    symbol: 'emoji' + id,
    sortOrder: id,
    levelRequirement: id,
    canUseInDonationMessage: true
  }
}
