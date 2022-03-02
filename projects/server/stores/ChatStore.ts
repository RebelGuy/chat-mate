import { Prisma } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { ChatItem, ChatItemWithRelations, PartialChatMessage, PartialCustomEmojiChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { assertUnreachable } from '@rebel/server/util/typescript'

export type ChatSave = {
  continuationToken: string | null
  chat: ChatItem[]
}

type Deps = Dependencies<{
  dbProvider: DbProvider,
  livestreamStore: LivestreamStore,
}>

export default class ChatStore extends ContextClass {
  readonly name = ChatStore.name
  private readonly db: Db
  private readonly livestreamStore: LivestreamStore

  constructor (dep: Deps) {
    super()
    this.db = dep.resolve('dbProvider').get()
    this.livestreamStore = dep.resolve('livestreamStore')
  }

  /** Adds the chat item, quietly ignoring duplicates. */
  public async addChat (chatItem: ChatItem, channelId: number) {
    // there is a race condition where the client may request messages whose message parts haven't yet been
    // completely written to the DB. bundle everything into a single transaction to solve this.
    await this.db.$transaction(async (db) => {
      const chatMessage = await db.chatMessage.upsert({
        create: {
          time: new Date(chatItem.timestamp),
          youtubeId: chatItem.id,
          channel: { connect: { id: channelId }},
          livestream: { connect: { id: this.livestreamStore.currentLivestream.id }}
        },
        update: {},
        where: { youtubeId: chatItem.id },
        include: { chatMessageParts: true }
      })

      // add the records individually because we can't access relations (emoji/text) in a createMany() query
      for (let i = 0; i < chatItem.messageParts.length; i++) {
        const part = chatItem.messageParts[i]
        if (chatMessage.chatMessageParts.find(existing => existing.order === i)) {
          // message part already exists
          continue
        }
        await db.chatMessagePart.create({ data: this.createChatMessagePart(part, i, chatMessage.id) })
      }
    })
  }

  /** Returns ordered chat items that may or may not be from the current livestream. */
  public async getChatSince (since: number, limit?: number): Promise<ChatItemWithRelations[]> {
    return await this.db.chatMessage.findMany({
      where: {
        time: { gt: new Date(since) }
      },
      orderBy: {
        time: 'asc'
      },
      include: {
        chatMessageParts: {
          orderBy: { order: 'asc' },
          include: {
            emoji: true,
            text: true,
            customEmoji: { include: { customEmoji: true, text: true }}
          },
        },
        channel: {
          include: {
            infoHistory: {
              orderBy: { time: 'desc' },
              take: 1
            }
          }
        }
      },
      take: limit
    })
  }

  private createChatMessagePart (part: PartialChatMessage, index: number, chatMessageId: number) {
    return Prisma.validator<Prisma.ChatMessagePartCreateInput>()({
      order: index,
      chatMessage: { connect: { id: chatMessageId }},
      text: part.type === 'text' ? { create: this.createText(part) } : undefined,
      emoji: part.type === 'emoji' ? { connectOrCreate: this.connectOrCreate(part) } : undefined,
      customEmoji: part.type === 'customEmoji' ? { create: { text: { create: this.createText(part) }, customEmoji: { connect: { id: part.customEmojiId } }}} : undefined
    })
  }

  private connectOrCreate (part: PartialEmojiChatMessage) {
    return Prisma.validator<Prisma.ChatEmojiCreateOrConnectWithoutMessagePartsInput>()({
      create: {
        youtubeId: part.emojiId,
        imageUrl: part.image.url,
        imageHeight: part.image.height ?? null,
        imageWidth: part.image.width ?? null,
        label: part.label,
        name: part.name,
        isCustomEmoji: false
      },
      where: { youtubeId: part.emojiId }
    })
  }

  private createText (part: PartialTextChatMessage | PartialCustomEmojiChatMessage) {
    if (part.type === 'text') {
      return Prisma.validator<Prisma.ChatTextCreateInput>()({
        isBold: part.isBold,
        isItalics: part.isItalics,
        text: part.text
      })
    } else if (part.type === 'customEmoji') {
      return Prisma.validator<Prisma.ChatTextCreateInput>()({
        isBold: part.text.isBold,
        isItalics: part.text.isItalics,
        text: part.text.text
      })
    } else {
      assertUnreachable(part)
    }
  }
}
