import { ChatMessage, Prisma } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { ChatItem, ChatItemWithRelations, PartialChatMessage, PartialCheerChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { reverse } from '@rebel/server/util/arrays'
import { assertUnreachable } from '@rebel/server/util/typescript'

export type ChatSave = {
  continuationToken: string | null
  chat: ChatItem[]
}

type Deps = Dependencies<{
  dbProvider: DbProvider
  livestreamStore: LivestreamStore
  dbTransactionTimeout: number
}>

export default class ChatStore extends ContextClass {
  readonly name = ChatStore.name
  private readonly db: Db
  private readonly livestreamStore: LivestreamStore
  private readonly dbTransactionTimeout: number

  constructor (deps: Deps) {
    super()
    this.db = deps.resolve('dbProvider').get()
    this.livestreamStore = deps.resolve('livestreamStore')
    this.dbTransactionTimeout = deps.resolve('dbTransactionTimeout')
  }

  /** Adds the chat item, quietly ignoring duplicates. */
  public async addChat (chatItem: ChatItem, streamerId: number, defaultUserId: number, channelId: string): Promise<ChatMessage> {
    let livestreamPart: Prisma.ChatMessageCreateInput['livestream']
    const activeLivestream = await this.livestreamStore.getActiveLivestream(streamerId)
    if (activeLivestream == null) {
      livestreamPart = undefined
    } else {
      livestreamPart = { connect: { id: activeLivestream.id }}
    }

    // there is a race condition where the client may request messages whose message parts haven't yet been
    // completely written to the DB. bundle everything into a single transaction to solve this.
    return await this.db.$transaction(async (db) => {
      const chatMessage = await db.chatMessage.upsert({
        create: {
          time: new Date(chatItem.timestamp),
          streamer: { connect: { id: streamerId }},
          externalId: chatItem.id,
          contextToken: chatItem.platform === 'youtube' ? chatItem.contextToken : chatItem.platform === 'twitch' ? undefined : assertUnreachable(chatItem),
          user: { connect: { id: defaultUserId }},
          youtubeChannel: chatItem.platform === 'youtube' ? { connect: { youtubeId: channelId }} : chatItem.platform === 'twitch' ? undefined : assertUnreachable(chatItem),
          twitchChannel: chatItem.platform === 'twitch' ? { connect: { twitchId: channelId }} : chatItem.platform === 'youtube' ? undefined : assertUnreachable(chatItem),
          livestream: livestreamPart
        },
        update: {},
        where: { externalId: chatItem.id },
        include: { chatMessageParts: true }
      })

      // add the records individually because we can't access relations (emoji/text) in a createMany() query
      let createParts = []
      for (let i = 0; i < chatItem.messageParts.length; i++) {
        const part = chatItem.messageParts[i]
        if (chatMessage.chatMessageParts.find(existing => existing.order === i)) {
          // message part already exists
          continue
        }
        createParts.push(db.chatMessagePart.create({ data: createChatMessagePart(part, i, chatMessage.id) }))
      }

      await Promise.all(createParts)
      return chatMessage
    }, {
      timeout: this.dbTransactionTimeout ?? undefined
    })
  }

  public async getLastChatByYoutubeChannel (streamerId: number, youtubeChannelId: number): Promise<ChatItemWithRelations | null> {
    return await this.db.chatMessage.findFirst({
      where: {
        streamerId: streamerId,
        youtubeChannel: { id: youtubeChannelId }
      },
      orderBy: { time: 'desc' },
      include: chatMessageIncludeRelations
    })
  }

  /** For each user, returns the last chat item authored by the user or any of its linked users.
   * Throws if no chat message was found for any of the given user ids. */
  public async getLastChatOfUsers (streamerId: number, primaryUserIds: number[]): Promise<ChatItemWithRelations[]> {
    const chatMessagesForDefaultUsers = await this.db.chatMessage.findMany({
      distinct: ['userId'],
      orderBy: {
        time: 'desc'
      },
      include: chatMessageIncludeRelations,
      where: {
        streamerId: streamerId,
        userId: { in: primaryUserIds }
      }
    })

    const chatMessagesForAggregateUsers = await this.db.chatMessage.findMany({
      distinct: ['userId'],
      orderBy: {
        time: 'desc'
      },
      include: chatMessageIncludeRelations,
      where: {
        streamerId: streamerId,
        user: { aggregateChatUserId: { in: primaryUserIds } }
      }
    })

    return primaryUserIds.map(id => {
      const message = chatMessagesForDefaultUsers.find(c => c.userId === id)?? chatMessagesForAggregateUsers.find(c => c.user!.aggregateChatUserId === id)
      if (message == null) {
        throw new Error(`Could not find a chat message for primary user ${id} for streamer ${streamerId}`)
      } else {
        return message
      }
    })
  }

  /** Returns ordered chat items (from earliest to latest) that may or may not be from the current livestream. */
  public async getChatSince (streamerId: number, since: number, beforeOrAt?: number, limit?: number): Promise<ChatItemWithRelations[]> {
    const result = await this.db.chatMessage.findMany({
      where: {
        streamerId: streamerId,
        time: {
          gt: new Date(since),
          lte: beforeOrAt == null ? undefined : new Date(beforeOrAt)
        },
        donationId: null
      },
      // we want to get the latest results
      orderBy: { time: 'desc' },
      include: chatMessageIncludeRelations,
      take: limit
    })

    return reverse(result)
  }

  public async getChatById (chatMessageId: number): Promise<ChatItemWithRelations> {
    return await this.db.chatMessage.findUnique({
      where: { id: chatMessageId },
      include: chatMessageIncludeRelations,
      rejectOnNotFound: true
    })
  }
}

const includeChannelInfo = {
  include: Prisma.validator<Prisma.YoutubeChannelInclude | Prisma.TwitchChannelInclude>()({
    infoHistory: {
      orderBy: { time: 'desc' },
      take: 1
    }
  })
}

export const chatMessageIncludeRelations = Prisma.validator<Prisma.ChatMessageInclude>()({
  chatMessageParts: {
    orderBy: { order: 'asc' },
    include: {
      emoji: true,
      text: true,
      customEmoji: { include: {
        customEmojiVersion: { include: { customEmoji: { include: { customEmojiRankWhitelist: { select: { rankId: true } } } } } }, // fuck me
        text: true,
        emoji: true
      }},
      cheer: true
    },
  },
  youtubeChannel: includeChannelInfo,
  twitchChannel: includeChannelInfo,
  chatCommand: true,
  user: { include: { aggregateChatUser: true } }
})

export function createChatMessagePart (part: PartialChatMessage, index: number, chatMessageId: number) {
  return Prisma.validator<Prisma.ChatMessagePartCreateInput>()({
    order: index,
    chatMessage: { connect: { id: chatMessageId }},
    text: part.type === 'text' ? { create: createText(part) } : part.type === 'emoji' || part.type === 'customEmoji' || part.type === 'cheer' ? undefined : assertUnreachable(part),
    emoji: part.type === 'emoji' ? { connectOrCreate: connectOrCreateEmoji(part) } : part.type === 'text' || part.type === 'customEmoji' || part.type === 'cheer' ? undefined : assertUnreachable(part),
    customEmoji: part.type === 'customEmoji' ? { create: {
      text: part.text == null ? undefined : { create: createText(part.text) },
      emoji: part.emoji == null ? undefined : { connectOrCreate: connectOrCreateEmoji(part.emoji) },
      customEmojiVersion: { connect: { customEmojiId_version: { customEmojiId: part.customEmojiId, version: part.customEmojiVersion } } }}
    } : part.type === 'text' || part.type === 'emoji' || part.type === 'cheer' ? undefined : assertUnreachable(part),
    cheer: part.type === 'cheer' ? { create: createCheer(part) } : part.type === 'text' || part.type === 'emoji' || part.type === 'customEmoji' ? undefined : assertUnreachable(part)
  })
}

function connectOrCreateEmoji (part: PartialEmojiChatMessage) {
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

function createText (part: PartialTextChatMessage) {
  return Prisma.validator<Prisma.ChatTextCreateInput>()({
    isBold: part.isBold,
    isItalics: part.isItalics,
    text: part.text
  })
}

function createCheer (part: PartialCheerChatMessage) {
  return Prisma.validator<Prisma.ChatCheerCreateInput>()({
    amount: part.amount,
    colour: part.colour,
    imageUrl: part.imageUrl,
    name: part.name
  })
}
