import { Dependencies } from '@rebel/server/context/context'
import EmojiService from '@rebel/server/services/EmojiService'
import { expectObject, nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import { Entity } from '@rebel/server/models/entities'
import { PartialCheerChatMessage, PartialCustomEmojiChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import CustomEmojiEligibilityService from '@rebel/server/services/CustomEmojiEligibilityService'
import { CustomEmoji, CustomEmojiVersion } from '@prisma/client'

type EmojiData = Pick<CustomEmoji, 'id' | 'symbol'> & Pick<CustomEmojiVersion, 'image' | 'levelRequirement' | 'name'>

const userId = 1
const streamerId = 2
const customEmoji1: EmojiData = { id: 1, name: 'Emoji 1', symbol: 'emoji1', levelRequirement: 1, image: Buffer.from('') }
const customEmoji2: EmojiData = { id: 2, name: 'Emoji 2', symbol: 'emoji2', levelRequirement: 2, image: Buffer.from('') }
const customEmoji3: EmojiData = { id: 3, name: 'Emoji 3', symbol: 'emoji3', levelRequirement: 3, image: Buffer.from('') }
const customEmoji1Version = 0
const customEmoji2Version = 1
const customEmoji3Version = 2

let mockCustomEmojiServiceEligibilityService: MockProxy<CustomEmojiEligibilityService>
let emojiService: EmojiService

beforeEach(() => {
  mockCustomEmojiServiceEligibilityService = mock()
  mockCustomEmojiServiceEligibilityService.getEligibleEmojis.calledWith(userId, streamerId).mockResolvedValue([
    { id: customEmoji1.id, symbol: customEmoji1.symbol, latestVersion: customEmoji1Version },
    { id: customEmoji2.id, symbol: customEmoji2.symbol, latestVersion: customEmoji2Version },
    { id: customEmoji3.id, symbol: customEmoji3.symbol, latestVersion: customEmoji3Version }
  ])

  emojiService = new EmojiService(new Dependencies({
    customEmojiEligibilityService: mockCustomEmojiServiceEligibilityService
  }))
})

describe(nameof(EmojiService, 'applyCustomEmojis'), () => {
  test('part passed through if not eligible for any emojis', async () => {
    mockCustomEmojiServiceEligibilityService.getEligibleEmojis.mockReset().calledWith(userId, streamerId).mockResolvedValue([])
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:${customEmoji1.symbol}:`,
      isBold: true,
      isItalics: false
    }

    const result = await emojiService.applyCustomEmojis(part, userId, streamerId)

    expect(single(result)).toBe(part)
  })

  test('non-matching emoji part is passed through', async () => {
    const emojiPart: PartialEmojiChatMessage = {
      type: 'emoji',
      emojiId: 'id',
      image: { url: 'testUrl' },
      label: ':test:',
      name: 'TestEmoji'
    }

    const result = await emojiService.applyCustomEmojis(emojiPart, userId, streamerId)

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

    const result = await emojiService.applyCustomEmojis(cheerPart, userId, streamerId)

    expect(single(result)).toBe(cheerPart)
  })

  test('matching emoji part is detected', async () => {
    const emojiPart: PartialEmojiChatMessage = {
      type: 'emoji',
      emojiId: 'id',
      image: { url: 'testUrl' },
      label: `:${customEmoji1.symbol.toUpperCase()}:`,
      name: 'TestEmoji'
    }

    const result = await emojiService.applyCustomEmojis(emojiPart, userId, streamerId)

    expect(single(result)).toEqual<PartialCustomEmojiChatMessage>({
      type: 'customEmoji',
      customEmojiId: customEmoji1.id,
      customEmojiVersion: customEmoji1Version,
      emoji: expect.objectContaining(emojiPart),
      text: null
    })
  })

  test('text message is made up entirely of a single custom emoji', async () => {
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:${customEmoji1.symbol}:`,
      isBold: true,
      isItalics: false
    }

    const result = await emojiService.applyCustomEmojis(part, userId, streamerId)

    expect(single(result)).toEqual(expectedCustomEmojiPart(customEmoji1, customEmoji1Version, part))
  })

  test('text message contains two separated internal custom emojis', async () => {
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `abc :${customEmoji1.symbol}:def:${customEmoji2.symbol}: ghi`,
      isBold: true,
      isItalics: false
    }

    const result = await emojiService.applyCustomEmojis(part, userId, streamerId)

    expect(result.length).toBe(5)
    expect(result[0]).toEqual(expectedTextPart('abc ', part))
    expect(result[1]).toEqual(expectedCustomEmojiPart(customEmoji1, customEmoji1Version, part))
    expect(result[2]).toEqual(expectedTextPart('def', part))
    expect(result[3]).toEqual(expectedCustomEmojiPart(customEmoji2, customEmoji2Version, part))
    expect(result[4]).toEqual(expectedTextPart(' ghi', part))
  })

  test('text message contains only ineligible custom emojis', async () => {
    mockCustomEmojiServiceEligibilityService.getEligibleEmojis.mockReset().calledWith(userId, streamerId).mockResolvedValue([
      { id: customEmoji3.id, symbol: customEmoji3.symbol, latestVersion: customEmoji3Version }
    ])
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `Hello :${customEmoji1.symbol}::${customEmoji2.symbol}:`,
      isBold: true,
      isItalics: false
    }

    const result = await emojiService.applyCustomEmojis(part, userId, streamerId)

    expect(single(result)).toEqual(expectedTextPart(part.text, part))
  })

  test('text message contains one eligible and one ineligible custom emoji', async () => {
    mockCustomEmojiServiceEligibilityService.getEligibleEmojis.mockReset().calledWith(userId, streamerId).mockResolvedValue([
      { id: customEmoji1.id, symbol: customEmoji1.symbol, latestVersion: customEmoji1Version }
    ])
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:${customEmoji1.symbol}::${customEmoji2.symbol}:`,
      isBold: true,
      isItalics: false
    }

    const result = await emojiService.applyCustomEmojis(part, userId, streamerId)

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

    const result = await emojiService.applyCustomEmojis(part, userId, streamerId)

    const expectedResult = expectedCustomEmojiPart(customEmoji1, customEmoji1Version, part)
    expectedResult.text = part
    expect(single(result)).toEqual(expectedResult)
  })

  test('secondary troll emoji is matched if the user has access', async () => {
    const trollEmoji: EmojiData = { id: 1, name: 'Troll', symbol: 'troll', levelRequirement: 0, image: Buffer.from('') }
    const trollEmojiVersion = 1
    mockCustomEmojiServiceEligibilityService.getEligibleEmojis.mockReset().calledWith(userId, streamerId).mockResolvedValue([
      { id: customEmoji1.id, symbol: customEmoji1.symbol, latestVersion: customEmoji1Version },
      { id: customEmoji2.id, symbol: customEmoji2.symbol, latestVersion: customEmoji2Version },
      { id: trollEmoji.id, symbol: trollEmoji.symbol, latestVersion: trollEmojiVersion }
    ])

    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:troll:🧌`, // this weird character is the unicode troll emoji
      isBold: false,
      isItalics: false
    }

    const result = await emojiService.applyCustomEmojis(part, userId, streamerId)

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

    const result = await emojiService.applyCustomEmojis(part, userId, streamerId)

    expect(single(result)).toEqual(expectedTextPart(part.text, part))
  })
})

describe(nameof(EmojiService, 'applyCustomEmojisToDonation'), () => {
  test(`Forwards the text if it doesn't contain emojis`, async () => {
    mockCustomEmojiServiceEligibilityService.getEligibleDonationEmojis.mockResolvedValue([])
    const text = `:${customEmoji1.symbol}:`

    const result = await emojiService.applyCustomEmojisToDonation(text)

    expect(single(result)).toEqual(expectObject<PartialTextChatMessage>({ text }))
  })

  test('Applies only custom emojis with the donation flag enabled', async () => {
    mockCustomEmojiServiceEligibilityService.getEligibleDonationEmojis.mockResolvedValue([
      { id: customEmoji1.id, symbol: customEmoji1.symbol, latestVersion: customEmoji1Version },
      { id: customEmoji2.id, symbol: customEmoji2.symbol, latestVersion: customEmoji2Version }
    ])
    const text = `abc :${customEmoji1.symbol}:def:${customEmoji2.symbol}: ghi`

    const result = await emojiService.applyCustomEmojisToDonation(text)

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
    emoji: null
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
