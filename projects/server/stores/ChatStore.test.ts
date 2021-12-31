import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import LogService from '@rebel/server/services/LogService'
import ChannelStore, { CreateOrUpdateChannelArgs } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { getMockGetterMock, mockGetter, nameof, resolveValue, single } from '@rebel/server/_test/utils'
import { DeepMockProxy, mock, mockDeep, MockProxy } from 'jest-mock-extended'
import { Author, ChatItem, PartialChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import { ChannelInfo, Livestream } from '@prisma/client'

const livestream: Livestream = {
  id: 1,
  liveId: 'liveId',
  continuationToken: 'token',
  createdAt: new Date()
}

const author: Author = {
  attributes: { isModerator: true, isOwner: false, isVerified: false },
  channelId: 'author1',
  image: 'author1.image',
  name: 'author1.name'
}

const text1: PartialTextChatMessage = {
  type: 'text',
  text: 'text1',
  isBold: true,
  isItalics: false
}

const text2: PartialTextChatMessage = {
  type: 'text',
  text: 'text2',
  isBold: false,
  isItalics: true
}

const text3: PartialTextChatMessage = {
  type: 'text',
  text: 'text3',
  isBold: false,
  isItalics: false
}

const emoji1Saved: PartialEmojiChatMessage = {
  type: 'emoji',
  emojiId: 'emoji1.id',
  image: { url: 'emoji1.image' },
  label: 'emoji1.label',
  name: 'emoji1.name'
}

const emoji2New: PartialEmojiChatMessage = {
  type: 'emoji',
  emojiId: 'emoji2.id',
  image: { url: 'emoji2.image' },
  label: 'emoji2.label',
  name: 'emoji2.name'
}

function authorToChannelInfo (author: Author, time?: Date): Omit<ChannelInfo, 'channelId' | 'id'> {
  return {
    IsVerified: author.attributes.isVerified,
    isModerator: author.attributes.isModerator,
    isOwner: author.attributes.isOwner,
    imageUrl: author.image,
    name: author.name!,
    time: time ?? new Date()
  }
}

function authorToFullChannelInfo (author: Author, time?: Date): ChannelInfo {
  return {
    ...authorToChannelInfo(author, time),
    id: 1,
    channelId: 1
  }
}

function makeChatItem (...msg: PartialChatMessage[]): ChatItem {
  return {
    id: 'id1',
    timestamp: new Date(2021, 1, 1).getTime(),
    author: author,
    messageParts: msg
  }
}

export default () => {
  let mockChannelStore: DeepMockProxy<ChannelStore>
  let mockLivestreamStore: MockProxy<LivestreamStore>
  let mockLogService: DeepMockProxy<LogService>
  let chatStore: ChatStore
  let db: Db
  beforeEach(async () => {
    const dbProvider = await startTestDb()

    mockChannelStore = mockDeep<ChannelStore>()
    mockChannelStore.createOrUpdate.mockImplementation((channelId, args) => {
      if (channelId === author.channelId) {
        return resolveValue({
          id: 1,
          youtubeId: author.channelId,
          infoHistory: [authorToFullChannelInfo(author)]
        })
      } else {
        throw new Error('Invalid channelId')
      }
    })

    mockLivestreamStore = mock<LivestreamStore>()
    mockGetter(mockLivestreamStore, 'currentLivestream').mockReturnValue(livestream)

    mockLogService = mockDeep<LogService>()

    chatStore = new ChatStore(new Dependencies({
      dbProvider,
      channelStore: mockChannelStore,
      livestreamStore: mockLivestreamStore,
      logService: mockLogService
    }))
    db = dbProvider.get()

    await db.channel.create({ data: {
      youtubeId: author.channelId,
      infoHistory: { create: authorToChannelInfo(author)}
    }})
    await db.livestream.create({ data: livestream })
    await db.chatEmoji.create({ data: {
      isCustomEmoji: false,
      youtubeId: emoji1Saved.emojiId,
      imageUrl: emoji1Saved.image.url,
      label: emoji1Saved.label,
      name: emoji1Saved.name
    }})
  })

  afterEach(stopTestDb)

  describe(nameof(ChatStore, 'addChat'), () => {
    test('passes continuation token to livestream store', async () => {
      await chatStore.addChat('token', [])

      expect(single(mockLivestreamStore.setContinuationToken.mock.calls)[0]).toBe('token')
    })

    test('adds chat item with ordered text message parts', async () => {
      const chatItem = makeChatItem(text1, text2, text3)

      await chatStore.addChat('token', [chatItem])

      const saved1 = (await db.chatMessagePart.findFirst({ where: { order: 0 }, select: { text: true }}))?.text?.text
      const saved2 = (await db.chatMessagePart.findFirst({ where: { order: 1 }, select: { text: true }}))?.text?.text
      const saved3 = (await db.chatMessagePart.findFirst({ where: { order: 2 }, select: { text: true }}))?.text?.text
      expect([saved1, saved2, saved3]).toEqual([text1.text, text2.text, text3.text])
      await expectRowCount(db.chatMessage, db.chatMessagePart, db.chatText).toEqual([1, 3, 3])
    })

    test('adds chat item with message parts that reference existing emoji and new emoji', async () => {
      const chatItem = makeChatItem(emoji1Saved, emoji2New)

      await chatStore.addChat('token', [chatItem])

      await expectRowCount(db.chatMessage, db.chatMessagePart, db.chatEmoji).toEqual([1, 2, 2])
    })

    test('duplicate chat id ignored', async () => {
      const chatItem = makeChatItem(text1)
      db.chatMessage.create({ data: {
        time: new Date(chatItem.timestamp),
        youtubeId: chatItem.id,
        channelId: 1,
        livestreamId: 1
      }})

      await chatStore.addChat('token', [chatItem])

      await expectRowCount(db.chatMessage).toBe(1)
    })
  })

  describe(nameof(ChatStore, 'getChatSince'), () => {
    test('empty database returns empty array', async () => {
      const result = await chatStore.getChatSince(new Date().getTime())

      expect(result.length).toBe(0)
    })

    test('does not include earlier items', async () => {
      const chatItem1: ChatItem = { author: author, id: 'id1', timestamp: new Date(2021, 5, 1).getTime(), messageParts: [text1] }
      const chatItem2: ChatItem = { author: author, id: 'id2', timestamp: new Date(2021, 5, 2).getTime(), messageParts: [text2] }
      const chatItem3: ChatItem = { author: author, id: 'id3', timestamp: new Date(2021, 5, 3).getTime(), messageParts: [text3] }
      await chatStore.addChat('token', [chatItem1, chatItem2, chatItem3])

      const result = await chatStore.getChatSince(chatItem1.timestamp)

      expect(result.map(r => r.youtubeId)).toEqual([chatItem2.id, chatItem3.id])
    })
  })
}