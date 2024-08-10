import { YTEmoji, YTRun, YTTextRun } from '@rebel/masterchat'
import { ChatItemWithRelations, PartialChatMessage, PartialEmojiChatMessage, PartialProcessedEmojiChatMessage } from '@rebel/server/models/chat'
import CacheService from '@rebel/server/services/CacheService'
import { INACCESSIBLE_EMOJI } from '@rebel/server/services/ChatService'
import FileService from '@rebel/server/services/FileService'
import ImageService from '@rebel/server/services/ImageService'
import LogService from '@rebel/server/services/LogService'
import S3ProxyService from '@rebel/server/services/S3ProxyService'
import EmojiStore from '@rebel/server/stores/EmojiStore'
import RankStore from '@rebel/server/stores/RankStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { unique } from '@rebel/shared/util/arrays'
import { ChatMateError } from '@rebel/shared/util/error'
import { assertUnreachable } from '@rebel/shared/util/typescript'

// this is a selector sometimes used by emojis - it is an undesirably artefact, apparently
const variationSelector = RegExp('\ufe0f', 'g')

export type EmojiMap = Record<string, YTEmoji>

type Deps = Dependencies<{
  rankStore: RankStore
  emojiStore: EmojiStore
  s3ProxyService: S3ProxyService
  imageService: ImageService
  fileService: FileService
  logService: LogService
  cacheService: CacheService
}>

export default class EmojiService extends ContextClass {
  public readonly name = EmojiService.name

  private readonly rankStore: RankStore
  private readonly emojiStore: EmojiStore
  private readonly s3ProxyService: S3ProxyService
  private readonly imageService: ImageService
  private readonly fileService: FileService
  private readonly logService: LogService
  private readonly cacheService: CacheService

  constructor (deps: Deps) {
    super()

    this.rankStore = deps.resolve('rankStore')
    this.emojiStore = deps.resolve('emojiStore')
    this.s3ProxyService = deps.resolve('s3ProxyService')
    this.imageService = deps.resolve('imageService')
    this.fileService = deps.resolve('fileService')
    this.logService = deps.resolve('logService')
    this.cacheService = deps.resolve('cacheService')
  }

  /** Checks if there are any known emojis in the given text run and, if so, splits up the run appropriately. */
  public analyseYoutubeTextForEmojis (run: YTTextRun): YTRun[] {
    const emojiRegex = this.cacheService.getOrSetEmojiRegex(this.loadEmojiRegex)
    if (emojiRegex == null) {
      return [run]
    }

    let text = run.text.replace(variationSelector, '')
    let k = 0
    let result: YTRun[] = []
    let match: RegExpExecArray | null
    let emojiMap: EmojiMap | null = null

    // exact same algorithm that youtube uses, but with more readability
    while ((match = emojiRegex.exec(text.substring(k))) != null) {
      if (emojiMap == null) {
        emojiMap = this.loadEmojiMap()!
      }

      const matchIndex = match.index + k
      const emoji = emojiMap[match[0]] // the map of emojis to urls
      if (emoji != null) {
        // extract the text between the previous emoji and this emoji
        if (matchIndex > 0 && k < matchIndex) {
          result.push({ ...run, text: text.substring(k, matchIndex) })
        }

        // add this emoji
        result.push({ emoji: emoji })
      }

      k = matchIndex + match[0].length
    }

    if (k < text.length) {
      result.push({ ...run, text: text.substring(k) })
    }

    return result
  }

  /** Returns the ids of primary users that have access to use normal (i.e. non-custom) emojis. */
  public async getEligibleEmojiUsers (streamerId: number) {
    // todo: in the future, we will extend this to add some sort of permission system/config system to give the streamer control over who can use emojis
    const donators = await this.rankStore.getUserRanksForGroup('donation', streamerId)
    return unique(donators.map(d => d.primaryUserId))
  }

  public parseEmojiByUnicode (unicodeEmoji: string): YTEmoji | null {
    const emojiRegex = this.cacheService.getOrSetEmojiRegex(this.loadEmojiRegex)
    if (emojiRegex == null) {
      return null
    }

    const match = emojiRegex.exec(unicodeEmoji)
    if (match == null) {
      this.logService.logWarning(this, 'Unable to parse emoji from unicode character', unicodeEmoji)
      return null
    }

    const emojiMap = this.loadEmojiMap()!
    const emoji = emojiMap[match[0]]
    if (emoji == null) {
      this.logService.logWarning(this, 'Unable to find parsed emoji in the emoji map', match[0])
      return null
    }

    return emoji
  }

  /** Returns processed emojis for any public emojis. */
  public async processEmoji (message: PartialChatMessage): Promise<PartialChatMessage> {
    if (message.type === 'cheer' || message.type === 'text' || message.type === 'customEmoji' && message.text != null) {
      return message
    }

    if (message.type === 'processedEmoji' || message.type === 'customEmoji' && message.processedEmoji != null) {
      throw new ChatMateError('Unable to process emoji of a chat message that is already a processed emoji')
    }

    if (message.type === 'emoji') {
      return await this._processEmoji(message)
    } else if (message.type === 'customEmoji') {
      if (message.emoji == null) {
        throw new ChatMateError('Expected the customEmoji to have public emoji data attached to it')
      }

      message.processedEmoji = await this._processEmoji(message.emoji)
      return message
    } else {
      assertUnreachable(message)
    }
  }

  /** Signs CustomEmoji image URLs in-place. */
  public async signEmojiImages (chatMessageParts: ChatItemWithRelations['chatMessageParts']): Promise<void> {
    await Promise.all(chatMessageParts.map(async part => {
      if (part.emoji != null && part.emoji.image.url !== INACCESSIBLE_EMOJI) {
        part.emoji.image.url = await this.s3ProxyService.signUrl(part.emoji.image.url)
      } else if (part.customEmoji?.emoji != null && part.customEmoji.emoji.image.url !== INACCESSIBLE_EMOJI) {
        part.customEmoji.emoji.image.url = await this.s3ProxyService.signUrl(part.customEmoji.emoji.image.url)
      }
    }))
  }

  private async _processEmoji (message: PartialEmojiChatMessage): Promise<PartialProcessedEmojiChatMessage> {
    const emojiImage = await this.emojiStore.getOrCreateEmoji(message, (emojiId) => this.onGetImageInfo(message.url, emojiId))

    return {
      type: 'processedEmoji',
      emojiId: emojiImage.id
    }
  }

  private async onGetImageInfo (url: string, emojiId: number) {
    const imageData = await this.imageService.convertToPng(url)
    const fileName = getCustomEmojiFileUrl(emojiId)
    await this.s3ProxyService.uploadBase64Image(fileName, 'png', false, imageData)
    const relativeUrl = this.s3ProxyService.constructRelativeUrl(fileName)
    const dimensions = this.imageService.getImageDimensions(imageData)
    return {
      relativeImageUrl: relativeUrl,
      imageWidth: dimensions.width,
      imageHeight: dimensions.height
    }
  }

  private loadEmojiMap (): EmojiMap | null {
    const path = this.fileService.getDataFilePath('emojiMap.json')
    return this.fileService.readObject<EmojiMap>(path)
  }

  private loadEmojiRegex = () => {
    const emojiMap = this.loadEmojiMap()
    if (emojiMap == null) {
      this.logService.logWarning(this, 'Could not find the `emojiMap.json` file. Unicode emojis will not be processed.')
      return null
    }

    return RegExp(Object.keys(emojiMap).join('|').replace('*', '\\*'))
  }
}

function getCustomEmojiFileUrl (emojiId: number) {
  return `emoji/${emojiId}.png`
}
