import { ChatMessage, ChatMessagePart, Prisma } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import { ChatItem, ChatItemWithRelations, PartialChatMessage, PartialCheerChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { reverse } from '@rebel/shared/util/arrays'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import { ChatMessageForStreamerNotFoundError } from '@rebel/shared/util/error'

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

  /** Adds the chat item and returns it when done. Returns null if the chat item already exists. */
  public async addChat (chatItem: ChatItem, streamerId: number, defaultUserId: number, channelId: string): Promise<ChatMessage | null> {
    // get the youtube or twitch livestream that this chat message belongs to, if any
    let youtubeLivestreamPart: Prisma.ChatMessageCreateInput['youtubeLivestream']
    let twitchLivestreamPart: Prisma.ChatMessageCreateInput['twitchLivestream']
    if (chatItem.platform === 'youtube') {
      const activeLivestream = await this.livestreamStore.getActiveYoutubeLivestream(streamerId)
      if (activeLivestream == null) {
        youtubeLivestreamPart = undefined
      } else {
        youtubeLivestreamPart = { connect: { id: activeLivestream.id }}
      }
    } else if (chatItem.platform === 'twitch') {
      const activeLivestream = await this.livestreamStore.getCurrentTwitchLivestream(streamerId)
      if (activeLivestream == null) {
        twitchLivestreamPart = undefined
      } else {
        twitchLivestreamPart = { connect: { id: activeLivestream.id }}
      }
    } else {
      assertUnreachable(chatItem)
    }

    // there is a race condition where the client may request messages whose message parts haven't yet been
    // completely written to the DB. bundle everything into a single transaction to solve this.
    return await this.db.$transaction(async (db) => {
      let chatMessage: ChatMessage & { chatMessageParts: ChatMessagePart[] }
      try {
        chatMessage = await db.chatMessage.create({
          data: {
            time: new Date(chatItem.timestamp),
            streamer: { connect: { id: streamerId }},
            externalId: chatItem.id,
            contextToken: chatItem.platform === 'youtube' ? chatItem.contextToken : chatItem.platform === 'twitch' ? undefined : assertUnreachable(chatItem),
            user: { connect: { id: defaultUserId }},
            youtubeChannel: chatItem.platform === 'youtube' ? { connect: { youtubeId: channelId }} : chatItem.platform === 'twitch' ? undefined : assertUnreachable(chatItem),
            twitchChannel: chatItem.platform === 'twitch' ? { connect: { twitchId: channelId }} : chatItem.platform === 'youtube' ? undefined : assertUnreachable(chatItem),
            youtubeLivestream: youtubeLivestreamPart,
            twitchLivestream: twitchLivestreamPart
          },
          include: { chatMessageParts: true }
        })
      } catch (e: any) {
        if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
          return null
        } else {
          throw e
        }
      }

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

  public async getChatMessageCount (): Promise<number> {
    return await this.db.chatMessage.count()
  }

  public async getLastYoutubeChat (streamerId: number): Promise<ChatItemWithRelations | null> {
    return await this.db.chatMessage.findFirst({
      where: {
        streamerId: streamerId,
        NOT: { youtubeChannel: null }
      },
      orderBy: { time: 'desc' },
      include: chatMessageIncludeRelations
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

  /** For each user, returns the time of the first chat item authored by the user or any of its linked users.
   * @throws {@link ChatMessageForStreamerNotFoundError}: When no chat message was found for any of the given user ids for the specified streamer. */
  public async getTimeOfFirstChat (streamerId: number, primaryUserIds: number[]): Promise<{ primaryUserId: number, firstSeen: number }[]> {
    const userTimes = await this.db.chatMessage.findMany({
      distinct: ['userId'],
      orderBy: {
        time: 'asc'
      },
      select: {
        time: true,
        user: true
      },
      where: {
        streamerId: streamerId,
        OR: [
          { userId: { in: primaryUserIds } },
          { user: { aggregateChatUserId: { in: primaryUserIds } } }
        ]
      }
    })

    return primaryUserIds.map(id => {
      const userTime = userTimes.find(c => c.user!.id === id || c.user!.aggregateChatUserId === id)
      if (userTime == null) {
        throw new ChatMessageForStreamerNotFoundError(`Could not find a chat message for primary user ${id} for streamer ${streamerId}`)
      } else {
        return { primaryUserId: id, firstSeen: userTime.time.getTime() }
      }
    })
  }

  /** For each user, returns the last chat item authored by the user or any of its linked users.
   * @throws {@link ChatMessageForStreamerNotFoundError}: When no chat message was found for any of the given user ids for the specified streamer. */
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
      const message = chatMessagesForDefaultUsers.find(c => c.userId === id) ?? chatMessagesForAggregateUsers.find(c => c.user!.aggregateChatUserId === id)
      if (message == null) {
        throw new ChatMessageForStreamerNotFoundError(`Could not find a chat message for primary user ${id} for streamer ${streamerId}`)
      } else {
        return message
      }
    })
  }

  /** Returns ordered chat items (from earliest to latest) that may or may not be from the current livestream.
   * If `deletedOnly` is not provided, returns only active chat messages. If true, returns only deleted messages since the given time (respecting all other provided filters). */
  public async getChatSince (streamerId: number, since: number, beforeOrAt?: number, limit?: number, userIds?: number[], deletedOnly?: boolean): Promise<ChatItemWithRelations[]> {
    const result = await this.db.chatMessage.findMany({
      where: {
        streamerId: streamerId,
        userId: userIds == null ? undefined : { in: userIds },
        time: deletedOnly ? undefined : {
          gt: new Date(since),
          lte: beforeOrAt == null ? undefined : new Date(beforeOrAt)
        },
        donationId: null,
        deletedTime: deletedOnly ? {
          gt: new Date(since),
          lte: beforeOrAt == null ? undefined : new Date(beforeOrAt)
        } : null
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

  /** Marks the specified message as deleted. Returns true if the message was deleted. */
  public async removeChat (externalMessageId: string): Promise<boolean> {
    const newMessage = await this.db.chatMessage.updateMany({
      where: {
        externalId: externalMessageId,
        deletedTime: null
      },
      data: { deletedTime: new Date() }
    })

    return newMessage.count > 0
  }
}

const includeChannelInfo = {
  include: Prisma.validator<Prisma.YoutubeChannelInclude | Prisma.TwitchChannelInclude>()({
    globalInfoHistory: {
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
      imageUrl: part.image.url,
      imageHeight: part.image.height ?? null,
      imageWidth: part.image.width ?? null,
      label: part.label,
      name: part.name,
      isCustomEmoji: false
    },
    where: { imageUrl: part.image.url }
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
