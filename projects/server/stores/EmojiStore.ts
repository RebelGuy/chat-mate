import { ChatEmoji } from '@prisma/client'
import { ChatEmojiWithImage, PartialEmojiChatMessage } from '@rebel/server/models/chat'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'
import { ImageInfo } from '@rebel/server/stores/CustomEmojiStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { GroupedSemaphore } from '@rebel/shared/util/Semaphore'

type Deps = Dependencies<{
  dbProvider: DbProvider
  chatMateStateService: ChatMateStateService
}>

export default class EmojiStore extends ContextClass {
  private readonly db: Db
  private readonly semaphore: GroupedSemaphore<string>

  constructor (deps: Deps) {
    super()

    this.db = deps.resolve('dbProvider').get()
    this.semaphore = deps.resolve('chatMateStateService').getEmojiSemaphore()
  }

  public async getOrCreateEmoji (chatEmojiMessage: PartialEmojiChatMessage, onGetImageInfo: (emojiId: number) => Promise<ImageInfo>): Promise<ChatEmojiWithImage> {
    try {
      await this.semaphore.enter(chatEmojiMessage.url)

      const existingEmoji = await this.db.chatEmoji.findUnique({
        where: { imageUrl: chatEmojiMessage.url },
        include: { image: true }
      })

      if (existingEmoji != null) {
        return existingEmoji
      }

      const chatEmoji = await this.db.chatEmoji.create({ data: {
        imageUrl: chatEmojiMessage.url,
        label: chatEmojiMessage.label ?? null,
        name: chatEmojiMessage.name ?? null,
        isCustomEmoji: false,
        image: { create: {
          fingerprint: `TEMP-${Date.now()}`,
          url: 'TEMP',
          width: 0,
          height: 0
        }}
      }})

      const imageInfo = await onGetImageInfo(chatEmoji.id)
      const image = await this.db.image.update({
        where: { id: chatEmoji.imageId },
        data: {
          fingerprint: getEmojiFingerprint(chatEmoji),
          url: imageInfo.relativeImageUrl,
          originalUrl: chatEmoji.imageUrl,
          width: imageInfo.imageWidth,
          height: imageInfo.imageHeight
        }
      })

      return {
        ...chatEmoji,
        image: image
      }

    } finally {
      this.semaphore.exit(chatEmojiMessage.url)
    }
  }
}

// fingerprinting by the url ensures we don't accidentally create duplicate records for the same url
// (and also it's consistent with the imageUrl being a unique column on chat_emoji)
function getEmojiFingerprint (emoji: ChatEmoji) {
  return `emoji/${emoji.imageUrl}`
}
