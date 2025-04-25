import { CustomEmoji } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import { ChatItemWithRelations, PartialChatMessage, PartialTextChatMessage, removeRangeFromText } from '@rebel/server/models/chat'
import AccountService from '@rebel/server/services/AccountService'
import CustomEmojiEligibilityService from '@rebel/server/services/CustomEmojiEligibilityService'
import CustomEmojiStore, { CurrentCustomEmoji, InternalCustomEmojiCreateData, InternalCustomEmojiUpdateData, CustomEmojiWithRankWhitelist } from '@rebel/server/stores/CustomEmojiStore'
import { single, zip } from '@rebel/shared/util/arrays'
import { ChatMateError, NotFoundError, UnsupportedFilteTypeError } from '@rebel/shared/util/error'
import S3ProxyService, { SignedUrl } from '@rebel/server/services/S3ProxyService'
import { parseDataUrl } from '@rebel/shared/util/text'
import ImageService from '@rebel/server/services/ImageService'
import { min } from '@rebel/shared/util/math'

export type CustomEmojiCreateData = InternalCustomEmojiCreateData & {
  imageDataUrl: string
}

export type CustomEmojiUpdateData = InternalCustomEmojiUpdateData & {
  imageDataUrl: string
}

export type FullCustomEmoji = CustomEmojiWithRankWhitelist & {
  imageUrl: SignedUrl
}

type SearchResult = {
  searchTerm: string
  startIndex: number
}

type Deps = Dependencies<{
  customEmojiEligibilityService: CustomEmojiEligibilityService
  accountService: AccountService
  s3ProxyService: S3ProxyService
  customEmojiStore: CustomEmojiStore
  imageService: ImageService
}>

const SUPPORTED_IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'svg+xml']

export default class CustomEmojiService extends ContextClass {
  private readonly customEmojiEligibilityService: CustomEmojiEligibilityService
  private readonly accountService: AccountService
  private readonly s3ProxyService: S3ProxyService
  private readonly customEmojiStore: CustomEmojiStore
  private readonly imageService: ImageService

  constructor (deps: Deps) {
    super()
    this.customEmojiEligibilityService = deps.resolve('customEmojiEligibilityService')
    this.accountService = deps.resolve('accountService')
    this.s3ProxyService = deps.resolve('s3ProxyService')
    this.customEmojiStore = deps.resolve('customEmojiStore')
    this.imageService = deps.resolve('imageService')
  }

  /** @throws {@link UnsupportedFilteTypeError}: When the image type is not supported. */
  public async addCustomEmoji (data: CustomEmojiCreateData): Promise<FullCustomEmoji> {
    const imageData = parseDataUrl(data.imageDataUrl)
    if (imageData.fileType !== 'image' || !SUPPORTED_IMAGE_TYPES.includes(imageData.fileSubType)) {
      throw new UnsupportedFilteTypeError('Unsupported file type.')
    }

    const existingEmojiId = await this.customEmojiStore.getEmojiIdFromStreamerSymbol(data.streamerId, data.symbol)
    if (existingEmojiId != null) {
      return await this.updateCustomEmoji({ ...data, id: existingEmojiId }, true)
    }

    let signedImageUrl: SignedUrl
    const newEmoji = await this.customEmojiStore.addCustomEmoji({
      symbol: data.symbol,
      canUseInDonationMessage: data.canUseInDonationMessage,
      levelRequirement: data.levelRequirement,
      name: data.name,
      sortOrder: data.sortOrder,
      streamerId: data.streamerId,
      whitelistedRanks: data.whitelistedRanks
    }, async (newEmojiId, newEmojiVersion) => {
      const pngData = await this.imageService.convertToPng(data.imageDataUrl, 'throw')
      const fileName = getCustomEmojiFileUrl(data.streamerId, newEmojiId, newEmojiVersion, 'png')
      signedImageUrl = await this.s3ProxyService.uploadBase64Image(fileName, 'png', false, pngData)
      const { width, height } = this.imageService.getImageDimensions(pngData)

      return {
        relativeImageUrl: this.s3ProxyService.constructRelativeUrl(fileName),
        imageWidth: width,
        imageHeight: height
      }
    })

    return {
      id: newEmoji.id,
      imageUrl: signedImageUrl!,
      imageWidth: newEmoji.imageWidth,
      imageHeight: newEmoji.imageHeight,
      name: newEmoji.name,
      symbol: newEmoji.symbol,
      version: newEmoji.version,
      deletedAt: null,
      sortOrder: newEmoji.sortOrder,
      streamerId: newEmoji.streamerId,
      modifiedAt: newEmoji.modifiedAt,
      levelRequirement: newEmoji.levelRequirement,
      whitelistedRanks: newEmoji.whitelistedRanks,
      canUseInDonationMessage: newEmoji.canUseInDonationMessage
    }
  }

  public async getAllCustomEmojis (streamerId: number): Promise<FullCustomEmoji[]> {
    const emojis = await this.customEmojiStore.getAllCustomEmojis(streamerId)

    const emojiImageUrls = await Promise.all(emojis.map(emoji => {
      return this.s3ProxyService.signUrl(emoji.imageUrl)
    }))

    return zip(emojis, emojiImageUrls.map(imageUrl => ({ imageUrl })))
  }

  /** Signs CustomEmoji image URLs in-place. */
  public async signEmojiImages (chatMessageParts: ChatItemWithRelations['chatMessageParts']): Promise<void> {
    await Promise.all(chatMessageParts.map(async part => {
      if (part.customEmoji != null) {
        part.customEmoji.customEmojiVersion.image.url = await this.s3ProxyService.signUrl(part.customEmoji.customEmojiVersion.image.url)
      }
    }))
  }

  /** Throws if the image is malformed. */
  public async updateCustomEmoji (data: CustomEmojiUpdateData, allowDeactivated: boolean): Promise<FullCustomEmoji> {
    const imageData = parseDataUrl(data.imageDataUrl)
    if (imageData.fileType !== 'image' || !SUPPORTED_IMAGE_TYPES.includes(imageData.fileSubType)) {
      throw new UnsupportedFilteTypeError('Unsupported file type.')
    }

    let signedImageUrl: SignedUrl
    const newEmoji = await this.customEmojiStore.updateCustomEmoji({
      id: data.id,
      canUseInDonationMessage: data.canUseInDonationMessage,
      levelRequirement: data.levelRequirement,
      name: data.name,
      whitelistedRanks: data.whitelistedRanks
    }, async (streamerId, newEmojiId, newEmojiVersion) => {
      const pngData = await this.imageService.convertToPng(data.imageDataUrl, 'throw')
      const fileName = getCustomEmojiFileUrl(streamerId, newEmojiId, newEmojiVersion, 'png')
      signedImageUrl = await this.s3ProxyService.uploadBase64Image(fileName, 'png', false, pngData)
      const { width, height } = this.imageService.getImageDimensions(pngData)

      return {
        relativeImageUrl: this.s3ProxyService.constructRelativeUrl(fileName),
        imageWidth: width,
        imageHeight: height
      }
    }, allowDeactivated)

    return {
      id: newEmoji.id,
      imageUrl: signedImageUrl!,
      imageWidth: newEmoji.imageWidth,
      imageHeight: newEmoji.imageHeight,
      name: newEmoji.name,
      symbol: newEmoji.symbol,
      version: newEmoji.version,
      deletedAt: null,
      sortOrder: newEmoji.sortOrder,
      streamerId: newEmoji.streamerId,
      modifiedAt: newEmoji.modifiedAt,
      levelRequirement: newEmoji.levelRequirement,
      whitelistedRanks: newEmoji.whitelistedRanks,
      canUseInDonationMessage: newEmoji.canUseInDonationMessage
    }
  }

  /** Shuffles the custom emoji sort orders such that the given emoji will appear first in the list. Returns the new sort order for the given emoji. */
  public async setFirstInSortOrder (streamerId: number, customEmojiId: number): Promise<number> {
    const allEmojis = await this.customEmojiStore.getAllCustomEmojis(streamerId)
    const allExceptThis = allEmojis.filter(e => e.id !== customEmojiId)
    if (allEmojis.length === allExceptThis.length) {
      throw new NotFoundError('Unable to find the given emoji')
    } else if (allExceptThis.length === 0) {
      // nothing to do here - the emoji is already first in the list
      return single(allEmojis).sortOrder
    }

    const sortOrders = allExceptThis.map(e => e.sortOrder)
    const [minSortOrder] = min(sortOrders)!
    const newSortOrders = sortOrders.map(s => s + 1)

    await this.customEmojiStore.updateCustomEmojiSortOrders([...allExceptThis.map(e => e.id), customEmojiId], [...newSortOrders, minSortOrder])
    return minSortOrder
  }

  /** Analyses the given chat message and inserts custom emojis where applicable. */
  public async applyCustomEmojis (parts: PartialChatMessage[], defaultUserId: number, streamerId: number): Promise<PartialChatMessage[]> {
    const primaryUserId = await this.accountService.getPrimaryUserIdFromAnyUser([defaultUserId]).then(single)
    const eligibleEmojis = await this.customEmojiEligibilityService.getEligibleEmojis(primaryUserId, streamerId)
    return parts.flatMap(part => this.applyEligibleEmojis(part, eligibleEmojis))
  }

  public async applyCustomEmojisToDonation (text: string, streamerId: number): Promise<PartialChatMessage[]> {
    const eligibleEmojis = await this.customEmojiEligibilityService.getEligibleDonationEmojis(streamerId)
    const part: PartialTextChatMessage = { type: 'text', text: text, isBold: false, isItalics: false }
    return this.applyEligibleEmojis(part, eligibleEmojis)
  }

  private applyEligibleEmojis (part: PartialChatMessage, eligibleEmojis: CurrentCustomEmoji[]): PartialChatMessage[] {
    if (part.type === 'customEmoji') {
      // this should never happen
      throw new ChatMateError('Cannot apply custom emojis to a message part of type PartialCustomEmojiChatMessage')
    }

    // ok I don't know what the proper way to do this is, but typing `:troll:` in YT will convert the message
    // into a troll emoji of type text... so I guess if the troll emoji is available, we add a special rule here
    const troll = eligibleEmojis.find(em => em.symbol.toLowerCase() === 'troll')
    if (troll != null) {
      const secondaryTrollEmoji: CurrentCustomEmoji = { ...troll, symbol: '🧌' }
      eligibleEmojis = [...eligibleEmojis, secondaryTrollEmoji]
    }

    const searchTerms = eligibleEmojis.map(getSymbolToMatch)

    if (part.type === 'emoji') {
      // youtube emoji - check if it has the same symbol (label) as one of our custom emojis.
      // this is an all-or-none match, so we don't need to split up the message part.
      // note that this does not work if a youtube emoji has multiple labels and our custom emoji symbol
      // is not the same as the shortest labels.
      const matchedIndex = searchTerms.findIndex(sym => sym.toLowerCase() === part.label.toLowerCase())
      if (matchedIndex === -1) {
        return [part]
      } else {
        return [{
          type: 'customEmoji',
          customEmojiId: eligibleEmojis[matchedIndex]!.id,
          customEmojiVersion: eligibleEmojis[matchedIndex]!.latestVersion,
          text: null,
          emoji: part,
          processedEmoji: null
        }]
      }
    } else if (part.type === 'cheer') {
      return [part]
    } else if (part.type === 'processedEmoji') {
      throw new ChatMateError('Did not expect to apply a custom emoji to a processedEmoji - emojis must be processed AFTER custom emojis have been applied')
    }

    const searchResults = this.findMatches(part.text, searchTerms)

    let remainderText: PartialTextChatMessage | null = part
    let result: PartialChatMessage[] = []
    for (const searchResult of searchResults) {
      if (remainderText == null) {
        throw new ChatMateError('The remainder text was null')
      }
      const indexShift = remainderText.text.length - part.text.length
      const [leading, removed, trailing] = removeRangeFromText(remainderText, searchResult.startIndex + indexShift, searchResult.searchTerm.length)

      if (leading != null) {
        result.push(leading)
      }

      result.push({
        type: 'customEmoji',
        customEmojiId: eligibleEmojis.find(e => getSymbolToMatch(e) === searchResult.searchTerm)!.id,
        customEmojiVersion: eligibleEmojis.find(e => getSymbolToMatch(e) === searchResult.searchTerm)!.latestVersion,
        text: removed,
        emoji: null,
        processedEmoji: null
      })

      remainderText = trailing
    }

    if (remainderText != null) {
      result.push(remainderText)
    }

    return result
  }

  /** Attempts to match the search terms, ignoring casings. Returns ordered search results. */
  private findMatches (text: string, searchTerms: string[]): SearchResult[] {
    let results: SearchResult[] = []

    text = text.toLowerCase()
    for (let i = 0; i < text.length; i++) {
      for (let j = 0; j < searchTerms.length; j++) {
        const term = searchTerms[j].toLowerCase()
        if (text.substring(i, i + term.length) === term) {
          results.push({ startIndex: i, searchTerm: searchTerms[j] })

          // the next outer loop iteration should start after this match.
          // -1 because the for-loop already increments by 1
          i += term.length - 1
          break
        }
      }
    }

    return results
  }
}

// includes the troll hack, as above
function getSymbolToMatch (customEmoji: CurrentCustomEmoji): string {
  return customEmoji.symbol === '🧌' ? '🧌' : `:${customEmoji.symbol}:`
}

function getCustomEmojiFileUrl (streamerId: number, emojiId: number, emojiVersion: number, fileType: string) {
  return `custom-emoji/${streamerId}/${emojiId}/${emojiVersion}.${fileType}`
}
