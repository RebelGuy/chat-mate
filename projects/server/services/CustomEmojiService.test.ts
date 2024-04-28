import { Dependencies } from '@rebel/shared/context/context'
import CustomEmojiService, { CustomEmojiCreateData, CustomEmojiUpdateData } from '@rebel/server/services/CustomEmojiService'
import { cast, expectArray, expectObject, nameof } from '@rebel/shared/testUtils'
import { single, single2 } from '@rebel/shared/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import { ChatItemWithRelations, PartialCheerChatMessage, PartialCustomEmojiChatMessage, PartialEmojiChatMessage, PartialProcessedEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import CustomEmojiEligibilityService from '@rebel/server/services/CustomEmojiEligibilityService'
import { CustomEmoji, CustomEmojiVersion } from '@prisma/client'
import AccountService from '@rebel/server/services/AccountService'
import S3ProxyService, { SignedUrl } from '@rebel/server/services/S3ProxyService'
import CustomEmojiStore, { CustomEmojiWithRankWhitelist } from '@rebel/server/stores/CustomEmojiStore'
import { ChatMateError, NotFoundError, UnsupportedFilteTypeError } from '@rebel/shared/util/error'
import ImageService from '@rebel/server/services/ImageService'

type EmojiData = Pick<CustomEmoji, 'id' | 'symbol'> & Pick<CustomEmojiVersion, 'levelRequirement' | 'name'>

const defaultUserId = 100
const primaryUserId = 45
const streamerId = 2
const customEmoji1: EmojiData = { id: 1, name: 'Emoji 1', symbol: 'emoji1', levelRequirement: 1 }
const customEmoji2: EmojiData = { id: 2, name: 'Emoji 2', symbol: 'emoji2', levelRequirement: 2 }
const customEmoji3: EmojiData = { id: 3, name: 'Emoji 3', symbol: 'emoji3', levelRequirement: 3 }
const customEmoji1Version = 0
const customEmoji2Version = 1
const customEmoji3Version = 2

let mockCustomEmojiServiceEligibilityService: MockProxy<CustomEmojiEligibilityService>
let mockAccountService: MockProxy<AccountService>
let mockS3ProxyService: MockProxy<S3ProxyService>
let mockCustomEmojiStore: MockProxy<CustomEmojiStore>
let mockImageService: MockProxy<ImageService>
let customEmojiService: CustomEmojiService

beforeEach(() => {
  mockAccountService = mock()
  mockAccountService.getPrimaryUserIdFromAnyUser.calledWith(expectArray<number>([defaultUserId])).mockResolvedValue([primaryUserId])

  mockCustomEmojiServiceEligibilityService = mock()
  mockCustomEmojiServiceEligibilityService.getEligibleEmojis.calledWith(primaryUserId, streamerId).mockResolvedValue([
    { id: customEmoji1.id, symbol: customEmoji1.symbol, streamerId: streamerId, sortOrder: 1, latestVersion: customEmoji1Version },
    { id: customEmoji2.id, symbol: customEmoji2.symbol, streamerId: streamerId, sortOrder: 2, latestVersion: customEmoji2Version },
    { id: customEmoji3.id, symbol: customEmoji3.symbol, streamerId: streamerId, sortOrder: 3, latestVersion: customEmoji3Version }
  ])

  mockS3ProxyService = mock()
  mockCustomEmojiStore = mock()
  mockImageService = mock()

  customEmojiService = new CustomEmojiService(new Dependencies({
    customEmojiEligibilityService: mockCustomEmojiServiceEligibilityService,
    accountService: mockAccountService,
    s3ProxyService: mockS3ProxyService,
    customEmojiStore: mockCustomEmojiStore,
    imageService: mockImageService
  }))
})

describe(nameof(CustomEmojiService, 'addCustomEmoji'), () => {
  test('Adds the emoji to the database and uploads the image to S3', async () => {
    const createData: CustomEmojiCreateData = {
      name: 'test',
      symbol: ':test:',
      canUseInDonationMessage: true,
      imageDataUrl: 'data:image/png;base64,abcde',
      levelRequirement: 10,
      sortOrder: 2,
      streamerId: streamerId,
      whitelistedRanks: []
    }
    mockCustomEmojiStore.getEmojiIdFromStreamerSymbol.calledWith(streamerId, createData.symbol).mockResolvedValue(null)

    const mockImageUrl = 'imageUrl'
    const mockResult: CustomEmojiWithRankWhitelist = {
      id: 5,
      name: 'test',
      canUseInDonationMessage: true,
      imageUrl: mockImageUrl,
      imageWidth: 100,
      imageHeight: 200,
      isActive: true,
      levelRequirement: 10,
      modifiedAt: new Date(),
      sortOrder: 2,
      streamerId: streamerId,
      symbol: ':test:',
      version: 2,
      whitelistedRanks: []
    }
    mockCustomEmojiStore.addCustomEmoji.mockImplementation(async (_, cb) => {
      await cb(mockResult.id, mockResult.version)
      return mockResult
    })

    const mockSignedImageUrl = 'signedUrl' as SignedUrl
    mockImageService.convertToPng.calledWith(createData.imageDataUrl).mockResolvedValue('abcde-converted')
    mockS3ProxyService.uploadBase64Image.calledWith(expect.any(String), 'png', false, 'abcde-converted').mockResolvedValue(mockSignedImageUrl)
    mockImageService.getImageDimensions.mockReturnValue({ width: 0, height: 0 }) // `calledWith` omitted here and checked below

    const result = await customEmojiService.addCustomEmoji(createData)

    expect(result).toEqual<typeof result>({
      id: mockResult.id,
      name: mockResult.name,
      symbol: mockResult.symbol,
      canUseInDonationMessage: mockResult.canUseInDonationMessage,
      isActive: true,
      modifiedAt: mockResult.modifiedAt,
      levelRequirement: mockResult.levelRequirement,
      sortOrder: mockResult.sortOrder,
      streamerId: mockResult.streamerId,
      version: mockResult.version,
      whitelistedRanks: mockResult.whitelistedRanks,
      imageUrl: mockSignedImageUrl,
      imageWidth: mockResult.imageWidth,
      imageHeight: mockResult.imageHeight
    })
    expect(single2(mockImageService.getImageDimensions.mock.calls)).toBe('abcde-converted')
  })

  test('Adds the emoji as a new version if the streamer-symbol already exists', async () => {
    const createData = cast<CustomEmojiCreateData>({
      symbol: ':test:',
      imageDataUrl: 'data:image/png;base64,abcde',
      streamerId: streamerId,
    })
    mockCustomEmojiStore.getEmojiIdFromStreamerSymbol.calledWith(streamerId, createData.symbol).mockResolvedValue(5)

    const mockImageUrl = 'imageUrl'
    const mockResult = cast<CustomEmojiWithRankWhitelist>({
      id: 5,
      imageUrl: mockImageUrl,
      streamerId: streamerId,
      symbol: ':test:',
    })
    mockCustomEmojiStore.updateCustomEmoji.mockImplementation(async (data, cb, allowDeactivated) => {
      if (data.id !== 5) {
        throw new Error('Unexpected id')
      } else if (!allowDeactivated) {
        throw new Error('Expected allowDeactivated to be true')
      }
      await cb(mockResult.streamerId, mockResult.id, mockResult.version)
      return mockResult
    })

    const mockSignedImageUrl = 'signedUrl' as SignedUrl
    mockImageService.convertToPng.calledWith(createData.imageDataUrl).mockResolvedValue('abcde-converted')
    mockS3ProxyService.uploadBase64Image.calledWith(expect.any(String), 'png', false, 'abcde-converted').mockResolvedValue(mockSignedImageUrl)
    mockImageService.getImageDimensions.mockReturnValue({ width: 0, height: 0 }) // `calledWith` omitted here and checked below

    const result = await customEmojiService.addCustomEmoji(createData)

    expect(result).toEqual(expectObject(result, {
      id: mockResult.id,
      symbol: mockResult.symbol,
      streamerId: mockResult.streamerId,
      imageUrl: mockSignedImageUrl,
    }))
    expect(single2(mockImageService.getImageDimensions.mock.calls)).toBe('abcde-converted')
  })

  test('Throws if the filetype is not supported', async () => {
    const createData = cast<CustomEmojiCreateData>({ imageDataUrl: 'data:image/tiff;base64,abcde' })

    await expect(() => customEmojiService.addCustomEmoji(createData)).rejects.toThrowError(UnsupportedFilteTypeError)
  })
})

describe(nameof(CustomEmojiService, 'getAllCustomEmojis'), () => {
  test('Gets all emojis with signed image urls', async () => {
    const imageUrl1 = 'imageUrl1'
    const imageUrl2 = 'imageUrl2'
    const mockEmojis = cast<CustomEmojiWithRankWhitelist[]>([
      { id: 1, imageUrl: imageUrl1 },
      { id: 2, imageUrl: imageUrl2 }
    ])
    mockCustomEmojiStore.getAllCustomEmojis.calledWith(streamerId).mockResolvedValue(mockEmojis)
    mockS3ProxyService.signUrl.calledWith('imageUrl1').mockResolvedValue('signedImageUrl1' as SignedUrl)
    mockS3ProxyService.signUrl.calledWith('imageUrl2').mockResolvedValue('signedImageUrl2' as SignedUrl)

    const result = await customEmojiService.getAllCustomEmojis(streamerId)

    expect(result).toEqual(expectObject(result, [
      { id: 1, imageUrl: 'signedImageUrl1' as SignedUrl },
      { id: 2, imageUrl: 'signedImageUrl2' as SignedUrl }
    ]))
  })
})

describe(nameof(CustomEmojiService, 'signEmojiImages'), () => {
  test('Signs all custom emojis in-place', async () => {
    const imageUrl1 = 'imageUrl1'
    const imageUrl2 = 'imageUrl2'
    const mockParts = cast<ChatItemWithRelations['chatMessageParts']>([
      { text: {}},
      { customEmoji: { customEmojiVersion: { image: { url: imageUrl1 }}}},
      { customEmoji: { customEmojiVersion: { image: { url: imageUrl2 }}}}
    ])

    mockS3ProxyService.signUrl.calledWith('imageUrl1').mockResolvedValue('signedImageUrl1' as SignedUrl)
    mockS3ProxyService.signUrl.calledWith('imageUrl2').mockResolvedValue('signedImageUrl2' as SignedUrl)

    await customEmojiService.signEmojiImages(mockParts)

    expect(mockParts[1].customEmoji?.customEmojiVersion.image.url).toBe('signedImageUrl1')
    expect(mockParts[2].customEmoji?.customEmojiVersion.image.url).toBe('signedImageUrl2')
  })
})

describe(nameof(CustomEmojiService, 'updateCustomEmoji'), () => {
  test('Updates the emoji in the database and uploads the image to S3', async () => {
    const updateData: CustomEmojiUpdateData = {
      id: 5,
      name: 'test',
      canUseInDonationMessage: true,
      imageDataUrl: 'data:image/png;base64,abcde',
      levelRequirement: 10,
      whitelistedRanks: []
    }

    const mockImageUrl = 'imageUrl'
    const mockResult: CustomEmojiWithRankWhitelist = {
      id: 5,
      name: 'test',
      canUseInDonationMessage: true,
      imageUrl: mockImageUrl,
      imageWidth: 100,
      imageHeight: 200,
      isActive: true,
      levelRequirement: 10,
      modifiedAt: new Date(),
      sortOrder: 2,
      streamerId: streamerId,
      symbol: ':test:',
      version: 2,
      whitelistedRanks: []
    }
    mockCustomEmojiStore.updateCustomEmoji.mockImplementation(async (_, cb, allowDeactivated) => {
      if (allowDeactivated) {
        throw new Error('allowDeactivated is expected to be false')
      }
      await cb(streamerId, mockResult.id, mockResult.version)
      return mockResult
    })

    const mockSignedImageUrl = 'signedUrl' as SignedUrl
    mockImageService.convertToPng.calledWith(updateData.imageDataUrl).mockResolvedValue('abcde-converted')
    mockS3ProxyService.uploadBase64Image.calledWith(expect.any(String), 'png', false, 'abcde-converted').mockResolvedValue(mockSignedImageUrl)
    mockImageService.getImageDimensions.mockReturnValue({ width: 0, height: 0 }) // `calledWith` omitted here and checked below

    const result = await customEmojiService.updateCustomEmoji(updateData, false)

    expect(result).toEqual<typeof result>({
      id: mockResult.id,
      name: mockResult.name,
      symbol: mockResult.symbol,
      canUseInDonationMessage: mockResult.canUseInDonationMessage,
      isActive: true,
      modifiedAt: mockResult.modifiedAt,
      levelRequirement: mockResult.levelRequirement,
      sortOrder: mockResult.sortOrder,
      streamerId: mockResult.streamerId,
      version: mockResult.version,
      whitelistedRanks: mockResult.whitelistedRanks,
      imageUrl: mockSignedImageUrl,
      imageWidth: mockResult.imageWidth,
      imageHeight: mockResult.imageHeight
    })
    expect(single2(mockImageService.getImageDimensions.mock.calls)).toBe('abcde-converted')
  })

  test('Throws if the filetype is not supported', async () => {
    const updateData = cast<CustomEmojiUpdateData>({ imageDataUrl: 'data:image/tiff;base64,abcde' })

    await expect(() => customEmojiService.updateCustomEmoji(updateData, false)).rejects.toThrowError(UnsupportedFilteTypeError)
  })
})

describe(nameof(CustomEmojiService, 'setFirstInSortOrder'), () => {
  test('Re-orders all other emojis', async () => {
    const allEmojis = cast<CustomEmojiWithRankWhitelist[]>([
      { id: 1, sortOrder: 5 },
      { id: 2, sortOrder: 6 },
      { id: 3, sortOrder: 7 },
      { id: 4, sortOrder: 8 }
    ])
    mockCustomEmojiStore.getAllCustomEmojis.calledWith(streamerId).mockResolvedValue(allEmojis)

    const result = await customEmojiService.setFirstInSortOrder(streamerId, 4)

    const reorderCall = single(mockCustomEmojiStore.updateCustomEmojiSortOrders.mock.calls)
    expect(reorderCall).toEqual<typeof reorderCall>([[1, 2, 3, 4], [6, 7, 8, 5]])
    expect(result).toBe(5)
  })

  test(`Returns the emoji's sort order if no other emoji exists`, async () => {
    const emojiId = 5
    const sortOrder = 9
    mockCustomEmojiStore.getAllCustomEmojis.calledWith(streamerId).mockResolvedValue(cast<CustomEmojiWithRankWhitelist[]>([{ id: emojiId, sortOrder }]))

    const result = await customEmojiService.setFirstInSortOrder(streamerId, emojiId)

    expect(result).toBe(sortOrder)
  })

  test(`Throws ${NotFoundError.name} if the given emoji was not found`, async () => {
    mockCustomEmojiStore.getAllCustomEmojis.calledWith(streamerId).mockResolvedValue(cast<CustomEmojiWithRankWhitelist[]>([{ id: -1 }]))

    await expect(() => customEmojiService.setFirstInSortOrder(streamerId, 5)).rejects.toThrowError(NotFoundError)
  })
})

describe(nameof(CustomEmojiService, 'applyCustomEmojis'), () => {
  test('part passed through if not eligible for any emojis', async () => {
    mockCustomEmojiServiceEligibilityService.getEligibleEmojis.mockReset().calledWith(primaryUserId, streamerId).mockResolvedValue([])
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:${customEmoji1.symbol}:`,
      isBold: true,
      isItalics: false
    }

    const result = await customEmojiService.applyCustomEmojis(part, defaultUserId, streamerId)

    expect(single(result)).toBe(part)
  })

  test('non-matching emoji part is passed through', async () => {
    const emojiPart: PartialEmojiChatMessage = {
      type: 'emoji',
      url: 'testUrl',
      label: ':test:',
      name: 'TestEmoji'
    }

    const result = await customEmojiService.applyCustomEmojis(emojiPart, defaultUserId, streamerId)

    expect(single(result)).toBe(emojiPart)
  })

  test('cheer part is passed through', async () => {
    const cheerPart: PartialCheerChatMessage = {
      type: 'cheer',
      amount: 100,
      colour: '#00FF00',
      imageUrl: 'test.com',
      name: 'cheer name'
    }

    const result = await customEmojiService.applyCustomEmojis(cheerPart, defaultUserId, streamerId)

    expect(single(result)).toBe(cheerPart)
  })

  test('matching emoji part is detected', async () => {
    const emojiPart: PartialEmojiChatMessage = {
      type: 'emoji',
      url: 'testUrl',
      label: `:${customEmoji1.symbol.toUpperCase()}:`,
      name: 'TestEmoji'
    }

    const result = await customEmojiService.applyCustomEmojis(emojiPart, defaultUserId, streamerId)

    expect(single(result)).toEqual<PartialCustomEmojiChatMessage>({
      type: 'customEmoji',
      customEmojiId: customEmoji1.id,
      customEmojiVersion: customEmoji1Version,
      emoji: expect.objectContaining(emojiPart),
      text: null,
      processedEmoji: null
    })
  })

  test('text message is made up entirely of a single custom emoji', async () => {
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:${customEmoji1.symbol}:`,
      isBold: true,
      isItalics: false
    }

    const result = await customEmojiService.applyCustomEmojis(part, defaultUserId, streamerId)

    expect(single(result)).toEqual(expectedCustomEmojiPart(customEmoji1, customEmoji1Version, part))
  })

  test('text message contains two separated internal custom emojis', async () => {
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `abc :${customEmoji1.symbol}:def:${customEmoji2.symbol}: ghi`,
      isBold: true,
      isItalics: false
    }

    const result = await customEmojiService.applyCustomEmojis(part, defaultUserId, streamerId)

    expect(result.length).toBe(5)
    expect(result[0]).toEqual(expectedTextPart('abc ', part))
    expect(result[1]).toEqual(expectedCustomEmojiPart(customEmoji1, customEmoji1Version, part))
    expect(result[2]).toEqual(expectedTextPart('def', part))
    expect(result[3]).toEqual(expectedCustomEmojiPart(customEmoji2, customEmoji2Version, part))
    expect(result[4]).toEqual(expectedTextPart(' ghi', part))
  })

  test('text message contains only ineligible custom emojis', async () => {
    mockCustomEmojiServiceEligibilityService.getEligibleEmojis.mockReset().calledWith(primaryUserId, streamerId).mockResolvedValue([
      { id: customEmoji3.id, symbol: customEmoji3.symbol, streamerId: streamerId, sortOrder: 1, latestVersion: customEmoji3Version }
    ])
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `Hello :${customEmoji1.symbol}::${customEmoji2.symbol}:`,
      isBold: true,
      isItalics: false
    }

    const result = await customEmojiService.applyCustomEmojis(part, defaultUserId, streamerId)

    expect(single(result)).toEqual(expectedTextPart(part.text, part))
  })

  test('text message contains one eligible and one ineligible custom emoji', async () => {
    mockCustomEmojiServiceEligibilityService.getEligibleEmojis.mockReset().calledWith(primaryUserId, streamerId).mockResolvedValue([
      { id: customEmoji1.id, symbol: customEmoji1.symbol, streamerId: streamerId, sortOrder: 1, latestVersion: customEmoji1Version }
    ])
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:${customEmoji1.symbol}::${customEmoji2.symbol}:`,
      isBold: true,
      isItalics: false
    }

    const result = await customEmojiService.applyCustomEmojis(part, defaultUserId, streamerId)

    expect(result.length).toBe(2)
    expect(result[0]).toEqual(expectedCustomEmojiPart(customEmoji1, customEmoji1Version, part))
    expect(result[1]).toEqual(expectedTextPart(`:${customEmoji2.symbol}:`, part))
  })

  test('symbol matching is case insensitive', async () => {
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:${customEmoji1.symbol.toUpperCase()}:`,
      isBold: true,
      isItalics: false
    }

    const result = await customEmojiService.applyCustomEmojis(part, defaultUserId, streamerId)

    const expectedResult = expectedCustomEmojiPart(customEmoji1, customEmoji1Version, part)
    expectedResult.text = part
    expect(single(result)).toEqual(expectedResult)
  })

  test('secondary troll emoji is matched if the user has access', async () => {
    const trollEmoji: EmojiData = { id: 1, name: 'Troll', symbol: 'troll', levelRequirement: 0 }
    const trollEmojiVersion = 1
    mockCustomEmojiServiceEligibilityService.getEligibleEmojis.mockReset().calledWith(primaryUserId, streamerId).mockResolvedValue([
      { id: customEmoji1.id, symbol: customEmoji1.symbol, streamerId: streamerId, sortOrder: 1, latestVersion: customEmoji1Version },
      { id: customEmoji2.id, symbol: customEmoji2.symbol, streamerId: streamerId, sortOrder: 2, latestVersion: customEmoji2Version },
      { id: trollEmoji.id, symbol: trollEmoji.symbol, streamerId: streamerId, sortOrder: 3, latestVersion: trollEmojiVersion }
    ])

    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:troll:🧌`, // this weird character is the unicode troll emoji
      isBold: false,
      isItalics: false
    }

    const result = await customEmojiService.applyCustomEmojis(part, defaultUserId, streamerId)

    expect(result.length).toBe(2)
    expect(result[0]).toEqual(expectedCustomEmojiPart(trollEmoji, trollEmojiVersion, part))

    const secondaryTrollEmoji = {
      ...trollEmoji,
      symbol: '🧌'
    }
    expect(result[1]).toEqual(expectedCustomEmojiPart(secondaryTrollEmoji, trollEmojiVersion, part, e => e.symbol))
  })

  test('secondary troll emoji is not matched if the user does not have access', async () => {
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:troll:🧌`,
      isBold: false,
      isItalics: false
    }

    const result = await customEmojiService.applyCustomEmojis(part, defaultUserId, streamerId)

    expect(single(result)).toEqual(expectedTextPart(part.text, part))
  })

  test('Throws if attempting to apply emojis to a processed emoji type', async () => {
    const part: PartialProcessedEmojiChatMessage = {
      type: 'processedEmoji',
      emojiId: 1
    }

    await expect(() => customEmojiService.applyCustomEmojis(part, defaultUserId, streamerId)).rejects.toThrow(ChatMateError)
  })
})

describe(nameof(CustomEmojiService, 'applyCustomEmojisToDonation'), () => {
  test(`Forwards the text if it doesn't contain emojis`, async () => {
    mockCustomEmojiServiceEligibilityService.getEligibleDonationEmojis.calledWith(streamerId).mockResolvedValue([])
    const text = `:${customEmoji1.symbol}:`

    const result = await customEmojiService.applyCustomEmojisToDonation(text, streamerId)

    expect(single(result)).toEqual(expectObject<PartialTextChatMessage>({ text }))
  })

  test('Applies only custom emojis with the donation flag enabled', async () => {
    mockCustomEmojiServiceEligibilityService.getEligibleDonationEmojis.calledWith(streamerId).mockResolvedValue([
      { id: customEmoji1.id, symbol: customEmoji1.symbol, streamerId: streamerId, sortOrder: 1, latestVersion: customEmoji1Version },
      { id: customEmoji2.id, symbol: customEmoji2.symbol, streamerId: streamerId, sortOrder: 2, latestVersion: customEmoji2Version }
    ])
    const text = `abc :${customEmoji1.symbol}:def:${customEmoji2.symbol}: ghi`

    const result = await customEmojiService.applyCustomEmojisToDonation(text, streamerId)

    expect(result.length).toBe(5)
    expect(result[0]).toEqual(expectObject<PartialTextChatMessage>({ text: 'abc ' }))
    expect(result[1]).toEqual(expectObject<PartialCustomEmojiChatMessage>({ customEmojiId: customEmoji1.id }))
    expect(result[2]).toEqual(expectObject<PartialTextChatMessage>({ text: 'def' }))
    expect(result[3]).toEqual(expectObject<PartialCustomEmojiChatMessage>({ customEmojiId: customEmoji2.id }))
    expect(result[4]).toEqual(expectObject<PartialTextChatMessage>({ text: ' ghi' }))
  })
})


function expectedCustomEmojiPart (customEmoji: EmojiData, expectedVersion: number, originalText: PartialTextChatMessage, symbolGetter?: (emoji: EmojiData) => string): PartialCustomEmojiChatMessage {
  return {
    type: 'customEmoji',
    customEmojiId: customEmoji.id,
    customEmojiVersion: expectedVersion,
    text: expect.objectContaining<PartialTextChatMessage>({
      type: 'text',
      text: symbolGetter ? symbolGetter(customEmoji) : `:${customEmoji.symbol}:`,
      isBold: originalText.isBold,
      isItalics: originalText.isItalics
    }),
    emoji: null,
    processedEmoji: null
  }
}

function expectedTextPart (text: string, originalText: PartialTextChatMessage): PartialTextChatMessage {
  return {
    type: 'text',
    text: text,
    isBold: originalText.isBold,
    isItalics: originalText.isItalics
  }
}
