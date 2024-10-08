import { ChatEmoji } from '@prisma/client'
import { ChatEmojiWithImage, PartialEmojiChatMessage } from '@rebel/server/models/chat'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'
import { ImageInfo } from '@rebel/server/services/ImageService'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { GroupedSemaphore } from '@rebel/shared/util/Semaphore'
import { randomString } from '@rebel/shared/util/random'

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

  /** Throws if the emoji was not found. */
  public async getEmojiById (emojiId: number): Promise<ChatEmojiWithImage> {
    return await this.db.chatEmoji.findUniqueOrThrow({
      where: { id: emojiId },
      include: { image: true }
    })
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
          fingerprint: getEmojiFingerprint(`TEMP-${randomString(12)}`),
          url: 'TEMP',
          width: 0,
          height: 0
        }}
      }})

      const imageInfo = await onGetImageInfo(chatEmoji.id)
      const image = await this.db.image.update({
        where: { id: chatEmoji.imageId },
        data: {
          fingerprint: getEmojiFingerprint(chatEmoji.imageUrl),
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
function getEmojiFingerprint (imageUrl: string) {
  return `emoji/${imageUrl}`
}
