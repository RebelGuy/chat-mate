import { ChatItemWithRelations, PartialChatMessage, PartialEmojiChatMessage, PartialProcessedEmojiChatMessage } from '@rebel/server/models/chat'
import { INACCESSIBLE_EMOJI } from '@rebel/server/services/ChatService'
import ImageService from '@rebel/server/services/ImageService'
import S3ProxyService from '@rebel/server/services/S3ProxyService'
import EmojiStore from '@rebel/server/stores/EmojiStore'
import RankStore from '@rebel/server/stores/RankStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { unique } from '@rebel/shared/util/arrays'
import { ChatMateError } from '@rebel/shared/util/error'
import { assertUnreachable } from '@rebel/shared/util/typescript'

type Deps = Dependencies<{
  rankStore: RankStore
  emojiStore: EmojiStore
  s3ProxyService: S3ProxyService
  imageService: ImageService
}>

export default class EmojiService extends ContextClass {
  private readonly rankStore: RankStore
  private readonly emojiStore: EmojiStore
  private readonly s3ProxyService: S3ProxyService
  private readonly imageService: ImageService

  constructor (deps: Deps) {
    super()

    this.rankStore = deps.resolve('rankStore')
    this.emojiStore = deps.resolve('emojiStore')
    this.s3ProxyService = deps.resolve('s3ProxyService')
    this.imageService = deps.resolve('imageService')
  }

  /** Returns the ids of primary users that have access to use normal (i.e. non-custom) emojis. */
  public async getEligibleEmojiUsers (streamerId: number) {
    // todo: in the future, we will extend this to add some sort of permission system/config system to give the streamer control over who can use emojis
    const donators = await this.rankStore.getUserRanksForGroup('donation', streamerId)
    return unique(donators.map(d => d.primaryUserId))
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
}

function getCustomEmojiFileUrl (emojiId: number) {
  return `emoji/${emojiId}.png`
}
