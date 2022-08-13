import { Dependencies } from '@rebel/server/context/context'
import EmojiService from '@rebel/server/services/EmojiService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import CustomEmojiStore from '@rebel/server/stores/CustomEmojiStore'
import { nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import { Entity } from '@rebel/server/models/entities'
import { PartialCheerChatMessage, PartialCustomEmojiChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import { asGte, asLte } from '@rebel/server/util/math'

const userId = 1
const customEmoji1: Entity.CustomEmoji = { id: 1, name: 'Emoji 1', symbol: 'emoji1', levelRequirement: 1, image: Buffer.from('') }
const customEmoji2: Entity.CustomEmoji = { id: 2, name: 'Emoji 2', symbol: 'emoji2', levelRequirement: 2, image: Buffer.from('') }
const customEmoji3: Entity.CustomEmoji = { id: 3, name: 'Emoji 3', symbol: 'emoji3', levelRequirement: 3, image: Buffer.from('') }

let mockCustomEmojiStore: MockProxy<CustomEmojiStore>
let mockExperienceService: MockProxy<ExperienceService>
let emojiService: EmojiService

beforeEach(() => {
  mockCustomEmojiStore = mock<CustomEmojiStore>()
  mockCustomEmojiStore.getAllCustomEmojis.mockResolvedValue([customEmoji1, customEmoji2, customEmoji3])

  mockExperienceService = mock<ExperienceService>()

  emojiService = new EmojiService(new Dependencies({
    customEmojiStore: mockCustomEmojiStore,
    experienceService: mockExperienceService
  }))
})

describe(nameof(EmojiService, 'applyCustomEmojis'), () => {
  test('non-matching emoji part is passed through', async () => {
    setupLevel(100)
    const emojiPart: PartialEmojiChatMessage = {
      type: 'emoji',
      emojiId: 'id',
      image: { url: 'testUrl' },
      label: ':test:',
      name: 'TestEmoji'
    }

    const result = await emojiService.applyCustomEmojis(emojiPart, userId)

    expect(single(result)).toBe(emojiPart)
  })

  test('cheer part is passed through', async () => {
    setupLevel(100)
    const cheerPart: PartialCheerChatMessage = {
      type: 'cheer',
      amount: 100,
      colour: '#00FF00',
      imageUrl: 'test.com',
      name: 'cheer name'
    }

    const result = await emojiService.applyCustomEmojis(cheerPart, userId)

    expect(single(result)).toBe(cheerPart)
  })

  test('matching emoji part is detected', async () => {
    setupLevel(100)
    const emojiPart: PartialEmojiChatMessage = {
      type: 'emoji',
      emojiId: 'id',
      image: { url: 'testUrl' },
      label: `:${customEmoji1.symbol.toUpperCase()}:`,
      name: 'TestEmoji'
    }

    const result = await emojiService.applyCustomEmojis(emojiPart, userId)

    expect(single(result)).toEqual<PartialCustomEmojiChatMessage>({
      type: 'customEmoji',
      customEmojiId: customEmoji1.id,
      emoji: expect.objectContaining(emojiPart),
      text: null
    })
  })

  test('text message is made up entirely of a single custom emoji', async () => {
    setupLevel(100)
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:${customEmoji1.symbol}:`,
      isBold: true,
      isItalics: false
    }

    const result = await emojiService.applyCustomEmojis(part, userId)

    expect(single(result)).toEqual(expectedCustomEmojiPart(customEmoji1, part))
  })

  test('text message contains two separated internal custom emojis', async () => {
    setupLevel(100)
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `abc :${customEmoji1.symbol}:def:${customEmoji2.symbol}: ghi`,
      isBold: true,
      isItalics: false
    }

    const result = await emojiService.applyCustomEmojis(part, userId)

    expect(result.length).toBe(5)
    expect(result[0]).toEqual(expectedTextPart('abc ', part))
    expect(result[1]).toEqual(expectedCustomEmojiPart(customEmoji1, part))
    expect(result[2]).toEqual(expectedTextPart('def', part))
    expect(result[3]).toEqual(expectedCustomEmojiPart(customEmoji2, part))
    expect(result[4]).toEqual(expectedTextPart(' ghi', part))
  })

  test('text message contains only ineligible custom emojis', async () => {
    setupLevel(0)
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `Hello :${customEmoji1.symbol}::${customEmoji2.symbol}:`,
      isBold: true,
      isItalics: false
    }

    const result = await emojiService.applyCustomEmojis(part, userId)

    expect(single(result)).toEqual(expectedTextPart(part.text, part))
  })

  test('text message contains one eligible and one ineligible custom emoji', async () => {
    setupLevel(1)
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:${customEmoji1.symbol}::${customEmoji2.symbol}:`,
      isBold: true,
      isItalics: false
    }

    const result = await emojiService.applyCustomEmojis(part, userId)

    expect(result.length).toBe(2)
    expect(result[0]).toEqual(expectedCustomEmojiPart(customEmoji1, part))
    expect(result[1]).toEqual(expectedTextPart(`:${customEmoji2.symbol}:`, part))
  })

  test('symbol matching is case insensitive', async () => {
    setupLevel(100)
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:${customEmoji1.symbol.toUpperCase()}:`,
      isBold: true,
      isItalics: false
    }

    const result = await emojiService.applyCustomEmojis(part, userId)

    const expectedResult = expectedCustomEmojiPart(customEmoji1, part)
    expectedResult.text = part
    expect(single(result)).toEqual(expectedResult)
  })

  test('secondary troll emoji is matched if the user has access', async () => {
    setupLevel(100)
    const trollEmoji: Entity.CustomEmoji = { id: 1, name: 'Troll', symbol: 'troll', levelRequirement: 0, image: Buffer.from('') }
    mockCustomEmojiStore.getAllCustomEmojis.mockResolvedValue([customEmoji1, customEmoji2, trollEmoji])
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:troll:🧌`,
      isBold: false,
      isItalics: false
    }

    const result = await emojiService.applyCustomEmojis(part, userId)

    expect(result.length).toBe(2)
    expect(result[0]).toEqual(expectedCustomEmojiPart(trollEmoji, part))

    const secondaryTrollEmoji = {
      ...trollEmoji,
      symbol: '🧌'
    }
    expect(result[1]).toEqual(expectedCustomEmojiPart(secondaryTrollEmoji, part, e => e.symbol))
  })

  test('secondary troll emoji is not matched if the user does not have access', async () => {
    setupLevel(0)
    const trollEmoji: Entity.CustomEmoji = { id: 1, name: 'Troll', symbol: 'troll', levelRequirement: 100, image: Buffer.from('') }
    mockCustomEmojiStore.getAllCustomEmojis.mockResolvedValue([customEmoji1, customEmoji2, trollEmoji])
    const part: PartialTextChatMessage = {
      type: 'text',
      text: `:troll:🧌`,
      isBold: false,
      isItalics: false
    }

    const result = await emojiService.applyCustomEmojis(part, userId)

    expect(single(result)).toEqual(expectedTextPart(part.text, part))
  })
})

function setupLevel (level: number) {
  mockExperienceService.getLevels
    .calledWith(expect.arrayContaining([userId]))
    .mockResolvedValue([{
      userId: userId,
      level: { level: asGte(level, 0), levelProgress: asLte(0, 1), totalExperience: 0 }
    }])
}

function expectedCustomEmojiPart (customEmoji: Entity.CustomEmoji, originalText: PartialTextChatMessage, symbolGetter?: (emoji: Entity.CustomEmoji) => string): PartialCustomEmojiChatMessage {
  return {
    type: 'customEmoji',
    customEmojiId: customEmoji.id,
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
