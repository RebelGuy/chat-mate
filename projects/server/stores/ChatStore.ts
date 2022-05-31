import { Prisma } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { ChatItem, ChatItemWithRelations, ChatPlatform, PartialChatMessage, PartialCheerChatMessage, PartialCustomEmojiChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
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
  public async addChat (chatItem: ChatItem, userId: number, channelId: string) {
    // there is a race condition where the client may request messages whose message parts haven't yet been
    // completely written to the DB. bundle everything into a single transaction to solve this.
    await this.db.$transaction(async (db) => {
      const chatMessage = await db.chatMessage.upsert({
        create: {
          time: new Date(chatItem.timestamp),
          externalId: chatItem.id,
          contextToken: chatItem.platform === 'youtube' ? chatItem.contextToken : chatItem.platform === 'twitch' ? undefined : assertUnreachable(chatItem),
          user: { connect: { id: userId }},
          youtubeChannel: chatItem.platform === 'youtube' ? { connect: { youtubeId: channelId }} : chatItem.platform === 'twitch' ? undefined : assertUnreachable(chatItem),
          twitchChannel: chatItem.platform === 'twitch' ? { connect: { twitchId: channelId }} : chatItem.platform === 'youtube' ? undefined : assertUnreachable(chatItem),
          livestream: { connect: { id: this.livestreamStore.currentLivestream.id }}
        },
        update: {},
        where: { externalId: chatItem.id },
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

  public async getLastChatByYoutubeChannel (youtubeChannelId: number): Promise<ChatItemWithRelations | null> {
    return await this.db.chatMessage.findFirst({
      where: { youtubeChannel: { id: youtubeChannelId }},
      orderBy: { time: 'desc' },
      include: chatMessageIncludeRelations
    })
  }

  /** Returns the last chat item authored by the user, if any, regardless of which channel was used. */
  public async getLastChatByUser (userId: number): Promise<ChatItemWithRelations | null> {
    return await this.db.chatMessage.findFirst({
      where: { userId: userId },
      orderBy: { time: 'desc' },
      include: chatMessageIncludeRelations
    })
  }

  /** Returns ordered chat items that may or may not be from the current livestream. */
  public async getChatSince (since: number, limit?: number): Promise<ChatItemWithRelations[]> {
    return await this.db.chatMessage.findMany({
      where: { time: { gt: new Date(since) } },
      orderBy: { time: 'asc' },
      include: chatMessageIncludeRelations,
      take: limit
    })
  }

  private createChatMessagePart (part: PartialChatMessage, index: number, chatMessageId: number) {
    return Prisma.validator<Prisma.ChatMessagePartCreateInput>()({
      order: index,
      chatMessage: { connect: { id: chatMessageId }},
      text: part.type === 'text' ? { create: this.createText(part) } : part.type === 'emoji' || part.type === 'customEmoji' || part.type === 'cheer' ? undefined : assertUnreachable(part),
      emoji: part.type === 'emoji' ? { connectOrCreate: this.connectOrCreateEmoji(part) } : part.type === 'text' || part.type === 'customEmoji' || part.type === 'cheer' ? undefined : assertUnreachable(part),
      customEmoji: part.type === 'customEmoji' ? { create: {
        text: part.text == null ? undefined : { create: this.createText(part.text) },
        emoji: part.emoji == null ? undefined : { connectOrCreate: this.connectOrCreateEmoji(part.emoji) },
        customEmoji: { connect: { id: part.customEmojiId } }}
      } : part.type === 'text' || part.type === 'emoji' || part.type === 'cheer' ? undefined : assertUnreachable(part),
      cheer: part.type === 'cheer' ? { create: this.createCheer(part) } : part.type === 'text' || part.type === 'emoji' || part.type === 'customEmoji' ? undefined : assertUnreachable(part)
    })
  }

  private connectOrCreateEmoji (part: PartialEmojiChatMessage) {
    return Prisma.validator<Prisma.ChatEmojiCreateOrConnectWithoutMessagePartsInput>()({
      create: {
        externalId: part.emojiId,
        imageUrl: part.image.url,
        imageHeight: part.image.height ?? null,
        imageWidth: part.image.width ?? null,
        label: part.label,
        name: part.name,
        isCustomEmoji: false
      },
      where: { externalId: part.emojiId }
    })
  }

  private createText (part: PartialTextChatMessage) {
    return Prisma.validator<Prisma.ChatTextCreateInput>()({
      isBold: part.isBold,
      isItalics: part.isItalics,
      text: part.text
    })
  }

  private createCheer (part: PartialCheerChatMessage) {
    return Prisma.validator<Prisma.ChatCheerCreateInput>()({
      amount: part.amount,
      colour: part.colour,
      imageUrl: part.imageUrl,
      name: part.name
    })
  }
}

const includeChannelInfo = {
  include: Prisma.validator<Prisma.ChannelInclude | Prisma.TwitchChannelInclude>()({
    infoHistory: {
      orderBy: { time: 'desc' },
      take: 1
    }
  })
}

const chatMessageIncludeRelations = Prisma.validator<Prisma.ChatMessageInclude>()({
  chatMessageParts: {
    orderBy: { order: 'asc' },
    include: {
      emoji: true,
      text: true,
      customEmoji: { include: { customEmoji: true, text: true, emoji: true }},
      cheer: true
    },
  },
  youtubeChannel: includeChannelInfo,
  twitchChannel: includeChannelInfo
})
