import { ChatEmojiWithImage, ChatItemWithRelations, PartialChatMessage, PartialEmojiChatMessage } from '@rebel/server/models/chat'
import { INACCESSIBLE_EMOJI } from '@rebel/server/services/ChatService'
import EmojiService, { EmojiMap } from '@rebel/server/services/EmojiService'
import FileService from '@rebel/server/services/FileService'
import ImageService from '@rebel/server/services/ImageService'
import S3ProxyService, { SignedUrl } from '@rebel/server/services/S3ProxyService'
import EmojiStore from '@rebel/server/stores/EmojiStore'
import RankStore, { UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { Dependencies } from '@rebel/shared/context/context'
import { cast, expectObject, nameof } from '@rebel/shared/testUtils'
import { ChatMateError } from '@rebel/shared/util/error'
import { MockProxy, mock } from 'jest-mock-extended'

let mockRankStore: MockProxy<RankStore>
let mockEmojiStore: MockProxy<EmojiStore>
let mockS3ProxyService: MockProxy<S3ProxyService>
let mockImageService: MockProxy<ImageService>
let mockFileService: MockProxy<FileService>
let emojiService: EmojiService

beforeEach(() => {
  mockRankStore = mock()
  mockEmojiStore = mock()
  mockS3ProxyService = mock()
  mockImageService = mock()
  mockFileService = mock()

  emojiService = new EmojiService(new Dependencies({
    rankStore: mockRankStore,
    emojiStore: mockEmojiStore,
    s3ProxyService: mockS3ProxyService,
    imageService: mockImageService,
    fileService: mockFileService,
    logService: mock()
  }))
})

describe(nameof(EmojiService, 'analyseYoutubeTextForEmojis'), () => {
  const emojiMap: EmojiMap = {
    emoji1: {
      emojiId: 'emoji1',
      image: { thumbnails: [{ url: 'url1' }]},
      searchTerms: [],
      shortcuts: []
    },
    emoji2: {
      emojiId: 'emoji2',
      image: { thumbnails: [{ url: 'url2' }]},
      searchTerms: [],
      shortcuts: []
    }
  }

  beforeEach(() => {
    const filePath = 'filePath'
    mockFileService.getDataFilePath.calledWith('emojiMap.json').mockReturnValue(filePath)
    mockFileService.readObject.calledWith(filePath).mockReturnValue(emojiMap)

    emojiService.initialise()
  })

  test('Strips out emojis padded with text correctly', () => {
    const run = { text: 'a' + 'emoji1' + 'b' + 'emoji2' + 'c' }

    const result = emojiService.analyseYoutubeTextForEmojis(run)

    expect(result).toEqual(expectObject(result, [
      { text: 'a' },
      { emoji: emojiMap.emoji1 },
      { text: 'b' },
      { emoji: emojiMap.emoji2 },
      { text: 'c' }
    ]))
  })

  test('Does nothing if the text does not contain any emojis', () => {
    const run = { text: 'abc' }

    const result = emojiService.analyseYoutubeTextForEmojis(run)

    expect(result).toEqual([run])
  })

  test('Strips out lonely emoji', () => {
    const run = { text: 'emoji1' }

    const result = emojiService.analyseYoutubeTextForEmojis(run)

    expect(result).toEqual([{ emoji: emojiMap.emoji1 }])
  })

  test('Strips out emoji pair', () => {
    const run = { text: 'emoji1' + 'emoji2' }

    const result = emojiService.analyseYoutubeTextForEmojis(run)

    expect(result).toEqual([{ emoji: emojiMap.emoji1 }, { emoji: emojiMap.emoji2 }])
  })

  test('Strips out emoji with leading text', () => {
    const run = { text: 'abc' + 'emoji1' }

    const result = emojiService.analyseYoutubeTextForEmojis(run)

    expect(result).toEqual([{ text: 'abc' }, { emoji: emojiMap.emoji1 }])
  })

  test('Strips out emoji with trailing text', () => {
    const run = { text: 'emoji1' + 'abc' }

    const result = emojiService.analyseYoutubeTextForEmojis(run)

    expect(result).toEqual([{ emoji: emojiMap.emoji1 }, { text: 'abc' }])
  })
})

describe(nameof(EmojiService, 'getEligibleEmojiUsers'), () => {
  test('Returns the ids of users with donation ranks', async () => {
    const streamerId = 4
    mockRankStore.getUserRanksForGroup.calledWith('donation', streamerId).mockResolvedValue(cast<UserRankWithRelations[]>([{ primaryUserId: 1 }, { primaryUserId: 1 }, { primaryUserId: 2 }]))

    const result = await emojiService.getEligibleEmojiUsers(streamerId)

    expect(result).toEqual([1, 2])
  })
})

describe(nameof(EmojiService, 'processEmoji'), () => {
  test('Processes a standalone emoji', async () => {
    const message = cast<PartialEmojiChatMessage>({ type: 'emoji', url: 'url' })
    const emojiId = 45
    const emoji = cast<ChatEmojiWithImage>({ id: emojiId })
    const convertedData = 'converted'
    const relativeUrl = 'relativeUrl'
    mockEmojiStore.getOrCreateEmoji.mockImplementation(async (msg, onGetImageInfo) => {
      if (msg !== message) throw new Error('Unexpected message')

      const imageInfo = await onGetImageInfo(emojiId)
      if (imageInfo.relativeImageUrl !== relativeUrl) throw new Error('Unexpected relativeImageUrl')
      if (imageInfo.imageWidth !== 1) throw new Error('Unexpected imageWidth')
      if (imageInfo.imageHeight !== 2) throw new Error('Unexpected imageHeight')

      return emoji
    })
    mockImageService.convertToPng.calledWith(message.url).mockResolvedValue(convertedData)
    mockS3ProxyService.uploadBase64Image.calledWith(expect.any(String), 'png', false, convertedData)
    mockS3ProxyService.constructRelativeUrl.calledWith(expect.any(String)).mockReturnValue(relativeUrl)
    mockImageService.getImageDimensions.calledWith(convertedData).mockReturnValue({ width: 1, height: 2 })

    const result = await emojiService.processEmoji(message)

    expect(result).toEqual<typeof result>({ type: 'processedEmoji', emojiId: emojiId })
  })

  test('Processes an emoji attached to a custom emoji', async () => {
    const message = cast<PartialEmojiChatMessage>({ type: 'emoji' })
    const emojiId = 45
    const emoji = cast<ChatEmojiWithImage>({ id: emojiId })
    mockEmojiStore.getOrCreateEmoji.calledWith(message, expect.anything()).mockResolvedValue(emoji)

    const result = await emojiService.processEmoji(message)

    expect(result).toEqual<typeof result>({ type: 'processedEmoji', emojiId: emojiId })
  })

  test('Throws if the emoji is already processed', async () => {
    const message1 = cast<PartialChatMessage>({ type: 'processedEmoji' })
    const message2 = cast<PartialChatMessage>({ type: 'customEmoji', processedEmoji: {} })

    await expect(() => emojiService.processEmoji(message1)).rejects.toThrowError(ChatMateError)
    await expect(() => emojiService.processEmoji(message2)).rejects.toThrowError(ChatMateError)
  })

  test(`Throws if the custom emoji doesn't have emoji data attaced to it`, async () => {
    const message = cast<PartialChatMessage>({ type: 'customEmoji', emoji: null })

    await expect(() => emojiService.processEmoji(message)).rejects.toThrowError(ChatMateError)
  })
})

describe(nameof(EmojiService, 'signEmojiImages'), () => {
  test('Signs urls for standalone and custom emojis', async () => {
    const messages = cast<ChatItemWithRelations['chatMessageParts']>([
      { emoji: { image: { url: 'url1' }}},
      { customEmoji: { emoji: { image: { url: 'url2' }}}},
    ])
    mockS3ProxyService.signUrl.calledWith('url').mockResolvedValue('signedUrl1' as SignedUrl)
    mockS3ProxyService.signUrl.calledWith('ur2').mockResolvedValue('signedUrl2' as SignedUrl)

    await emojiService.signEmojiImages(messages)

    expect(messages[0].emoji!.image!.url = 'signedUrl1')
    expect(messages[1].customEmoji!.emoji!.image!.url = 'signedUrl2')
  })

  test('Does not sign messages with inaccessible emojis', async () => {
    const messages = cast<ChatItemWithRelations['chatMessageParts']>([
      { emoji: { image: { url: INACCESSIBLE_EMOJI }}},
      { customEmoji: { emoji: { image: { url: INACCESSIBLE_EMOJI }}}},
    ])

    await emojiService.signEmojiImages(messages)

    expect(mockS3ProxyService.signUrl.mock.calls.length).toBe(0)
  })
})
