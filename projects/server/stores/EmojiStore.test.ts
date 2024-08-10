import { startTestDb, DB_TEST_TIMEOUT, expectRowCount, stopTestDb } from '@rebel/server/_test/db'
import { PartialEmojiChatMessage } from '@rebel/server/models/chat'
import { Db } from '@rebel/server/providers/DbProvider'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'
import EmojiStore from '@rebel/server/stores/EmojiStore'
import { Dependencies } from '@rebel/shared/context/context'
import { cast, expectObjectDeep, nameof, promised, throwAsync } from '@rebel/shared/testUtils'
import { GroupedSemaphore } from '@rebel/shared/util/Semaphore'
import { DbError } from '@rebel/shared/util/error'
import { mock } from 'jest-mock-extended'

export default () => {
  let emojiStore: EmojiStore
  let db: Db

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    db = dbProvider.get()

    const chatMateStateService = mock<ChatMateStateService>({ getEmojiSemaphore: () => new GroupedSemaphore(1) })

    emojiStore = new EmojiStore(new Dependencies({ dbProvider, chatMateStateService }))
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(EmojiStore, 'getEmojiById'), () => {
    test('Returns the correct emoji', async () => {
      await db.chatEmoji.create({ data: { imageUrl: 'url1', isCustomEmoji: false, image: { create: { fingerprint: '1', url: 'url1', width: 1, height: 1 }} }})
      await db.chatEmoji.create({ data: { imageUrl: 'url2', isCustomEmoji: false, image: { create: { fingerprint: '2', url: 'url2', width: 2, height: 2 }} }})

      const result = await emojiStore.getEmojiById(2)

      expect(result).toEqual(expectObjectDeep(result, { id: 2, image: { url: 'url2' } }))
    })

    test('Throws if the emoji does not exist', async () => {
      await expect(() => emojiStore.getEmojiById(123)).rejects.toThrowError(DbError)
    })
  })

  describe(nameof(EmojiStore, 'getOrCreateEmoji'), () => {
    test('Creates an emoji with the correct image data', async () => {
      await db.chatEmoji.create({ data: {
        imageUrl: 'url1',
        label: 'label1',
        name: 'name1',
        isCustomEmoji: false,
        image: { create: {
          fingerprint: 'fingerprint1',
          height: 1,
          width: 2,
          url: 'emoji/url1',
          originalUrl: 'url1'
        }}
      }})

      const message = cast<PartialEmojiChatMessage>({ url: 'url2' })
      const onGetImageInfo = (emojiId: number) => promised({ relativeImageUrl: 'relativeUrl' + emojiId, imageWidth: 100, imageHeight: 200 })

      const result = await emojiStore.getOrCreateEmoji(message, onGetImageInfo)

      await expectRowCount(db.chatEmoji, db.image).toEqual([2, 2])
      expect(result).toEqual(expectObjectDeep(result, {
        imageUrl: 'url2',
        image: { url: 'relativeUrl2', width: 100, height: 200 }
      }))
    })

    test('Retrieves an existing emoji', async () => {
      await db.chatEmoji.create({ data: {
        imageUrl: 'url1',
        label: 'label1',
        name: 'name1',
        isCustomEmoji: false,
        image: { create: {
          fingerprint: 'fingerprint1',
          height: 1,
          width: 2,
          url: 'emoji/url1',
          originalUrl: 'url1'
        }}
      }})
      const message = cast<PartialEmojiChatMessage>({ url: 'url1' })

      const result = await emojiStore.getOrCreateEmoji(message, throwAsync)

      await expectRowCount(db.chatEmoji, db.image).toEqual([1, 1])
      expect(result.id).toBe(1)
    })

    test('Duplicate requests for a new emoji are queued appropriately', async () => {
      // we need to ensure that, if a new emoji is encountered in two requests simultaneously,
      // only the first request creates the emoji, and the second requets fetches it.

      const message = cast<PartialEmojiChatMessage>({ url: 'url1' })
      const onGetImageInfo = (emojiId: number) => promised({ relativeImageUrl: 'relativeUrl' + emojiId, imageWidth: 100, imageHeight: 200 })

      const [result1, result2] = await Promise.all([emojiStore.getOrCreateEmoji(message, onGetImageInfo), emojiStore.getOrCreateEmoji(message, onGetImageInfo)])

      await expectRowCount(db.chatEmoji, db.image).toEqual([1, 1])
      expect(result1).toEqual(expectObjectDeep(result1, {
        imageUrl: 'url1',
        image: { url: 'relativeUrl1', width: 100, height: 200 }
      }))
      expect(result1).toEqual(expectObjectDeep(result2, {
        imageUrl: 'url1',
        image: { url: 'relativeUrl1', width: 100, height: 200 }
      }))
    })
  })
}
