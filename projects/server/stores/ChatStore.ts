import { Prisma } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { ChatItem, ChatItemWithRelations, PartialChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import LogService from '@rebel/server/services/LogService'
import ChannelStore, { CreateOrUpdateChannelArgs } from '@rebel/server/stores/ChannelStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { List } from 'immutable'

export type ChatSave = {
  continuationToken: string | null
  chat: ChatItem[]
}

type Deps = Dependencies<{
  dbProvider: DbProvider,
  logService: LogService,
  livestreamStore: LivestreamStore,
  channelStore: ChannelStore
}>

export default class ChatStore {
  readonly name = ChatStore.name
  private readonly db: Db
  private readonly logService: LogService
  private readonly livestreamStore: LivestreamStore
  private readonly channelStore: ChannelStore

  constructor (dep: Deps) {
    this.db = dep.resolve('dbProvider').get()
    this.logService = dep.resolve('logService')
    this.livestreamStore = dep.resolve('livestreamStore')
    this.channelStore = dep.resolve('channelStore')
  }

  public async addChat (token: string, newChat: ChatItem[]) {
    this.logService.logInfo(this, `Adding ${newChat.length} new chat items`)

    const sorted = List(newChat).sort((c1, c2) => c1.timestamp - c2.timestamp)
    for (const item of sorted) {
      await this.addChatItem(item)
    }

    // purposefully only set this AFTER everything has been added. if we set it before,
    // and something goes wrong with adding chat, the chat messages will be lost forever.
    await this.livestreamStore.setContinuationToken(token)
  }

  // returns ordered chat items
  public getChatSince (since: number, limit?: number): Promise<ChatItemWithRelations[]> {
    return this.db.chatMessage.findMany({
      where: {
        // same as using AND: {[...]}
        livestreamId: this.livestreamStore.currentLivestream.id,
        time: { gt: new Date(since) }
      },
      orderBy: {
        time: 'asc'
      },
      include: {
        chatMessageParts: {
          orderBy: { order: 'asc' },
          include: { emoji: true, text: true },
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

  // quietly ignore duplicates
  private async addChatItem (chatItem: ChatItem) {
    const author = chatItem.author
    const timestamp = chatItem.timestamp
    const channelInfo: CreateOrUpdateChannelArgs = {
      name: author.name ?? '',
      time: new Date(timestamp),
      imageUrl: author.image,
      isOwner: author.attributes.isOwner,
      isModerator: author.attributes.isModerator,
      IsVerified: author.attributes.isVerified
    }
    const channel = await this.channelStore.createOrUpdate(author.channelId, channelInfo)

    // there is a race condition where the client may request messages whose message parts haven't yet been
    // completely written to the DB. bundle everything into a single transaction to solve this.
    await this.db.$transaction(async (db) => {
      const chatMessage = await db.chatMessage.upsert({
        create: {
          time: new Date(timestamp),
          youtubeId: chatItem.id,
          channel: { connect: { id: channel.id }},
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

  private createChatMessagePart (part: PartialChatMessage, index: number, chatMessageId: number) {
    return Prisma.validator<Prisma.ChatMessagePartCreateInput>()({
      order: index,
      chatMessage: { connect: { id: chatMessageId }},
      text: part.type === 'text' ? { create: this.createText(part) } : undefined,
      emoji: part.type === 'emoji' ? { connectOrCreate: this.connectOrCreate(part) } : undefined
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

  private createText (part: PartialTextChatMessage) {
    return Prisma.validator<Prisma.ChatTextCreateInput>()({
      isBold: part.isBold,
      isItalics: part.isItalics,
      text: part.text
    })
  }
}
