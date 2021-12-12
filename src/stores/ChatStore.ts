import { Prisma } from '.prisma/client'
import { Dependencies } from '@rebel/context/context';
import { ChatItem, ChatItemWithRelations, PartialChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/models/chat';
import DbProvider, { Db } from '@rebel/providers/DbProvider'
import LogService from '@rebel/services/LogService'
import ChannelStore, { CreateOrUpdateChannelArgs } from '@rebel/stores/ChannelStore'
import LivestreamStore from '@rebel/stores/LivestreamStore'
import { List } from 'immutable';

export type ChatSave = {
  continuationToken: string | null
  chat: ChatItem[]
}

export default class ChatStore {
  readonly name = ChatStore.name
  private readonly db: Db
  private readonly logService: LogService
  private readonly livestreamStore: LivestreamStore
  private readonly channelStore: ChannelStore

  constructor (dep: Dependencies) {
    this.db = dep.resolve<DbProvider>(DbProvider.name).get()
    this.logService = dep.resolve<LogService>(LogService.name)
    this.livestreamStore = dep.resolve<LivestreamStore>(LivestreamStore.name)
    this.channelStore = dep.resolve<ChannelStore>(ChannelStore.name)
  }

  public async addChat (token: string, newChat: ChatItem[]) {
    this.logService.logDebug(this, `Adding ${newChat.length} new chat items`)

    const sorted = List(newChat).sort((c1, c2) => c1.timestamp - c2.timestamp)
    for (const item of sorted) {
      await this.addChatItem(item)
    }

    await this.livestreamStore.setContinuationToken(token)
  }

  // returns ordered chat items
  public async getChatSince (since: number, limit?: number): Promise<ChatItemWithRelations[]> {
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

  public getContinuationToken (): string | null {
    // what happens if the token is very old? can we get ALL messages until now in a single request, or what happens?
    return this.livestreamStore.currentLivestream.continuationToken
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

    const chatMessage = await this.db.chatMessage.upsert({
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
      await this.db.chatMessagePart.create({ data: this.createChatMessagePart(part, i, chatMessage.id) })
    }
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
    const youtubeId = this.getEmojiYoutubeId(part)
    return Prisma.validator<Prisma.ChatEmojiCreateOrConnectWithoutMessagePartsInput>()({
      create: {
        youtubeId,
        imageUrl: part.image.url,
        imageHeight: part.image.height ?? null,
        imageWidth: part.image.width ?? null,
        label: part.label,
        name: part.name,
        isCustomEmoji: false
      },
      where: { youtubeId }
    })
  }

  private getEmojiYoutubeId (part: PartialEmojiChatMessage) {
    // remove in CHAT-79
    return `Unknown-${part.name ?? part.label}`
  }

  private createText (part: PartialTextChatMessage) {
    return Prisma.validator<Prisma.ChatTextCreateInput>()({
      isBold: part.isBold,
      isItalics: part.isItalics,
      text: part.text
    })
  }
}
