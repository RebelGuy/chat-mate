import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import ChatStore from '@rebel/server/stores/ChatStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { mockGetter, nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import { Author, ChatItem, PartialChatMessage, PartialCheerChatMessage, PartialCustomEmojiChatMessage, PartialEmojiChatMessage, PartialTextChatMessage, TwitchAuthor } from '@rebel/server/models/chat'
import { YoutubeChannelInfo, Livestream, TwitchChannelInfo } from '@prisma/client'
import * as data from '@rebel/server/_test/testData'

const livestream: Livestream = {
  id: 1,
  liveId: 'liveId',
  continuationToken: 'token',
  createdAt: new Date(),
  start: new Date(),
  end: null,
  isActive: true,
  type: 'publicLivestream'
}

const youtube1UserId = 1
const extYoutubeChannel1 = 'channel1'
const youtube2UserId = 1
const extYoutubeChannel2 = 'channel_2'
const twitchUserId = 2
const extTwitchChannel = 'channel2'

const ytAuthor1: Author = {
  attributes: { isModerator: true, isOwner: false, isVerified: false },
  channelId: extYoutubeChannel1,
  image: 'author1.image',
  name: 'author1.name'
}
const ytAuthor2: Author = {
  attributes: { isModerator: false, isOwner: true, isVerified: false },
  channelId: extYoutubeChannel2,
  image: 'author2.image',
  name: 'author2.name'
}
const twitchAuthor: TwitchAuthor = {
  userId: extTwitchChannel,
  userName: 'rebel_guymc',
  displayName: 'Rebel Guy',
  color: '#FF00FF',
  isMod: false,
  isBroadcaster: true,
  isVip: false,
  isSubscriber: false,
  userType: undefined,
  badgeInfo: new Map(),
  badges: new Map()
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

const cheer1: PartialCheerChatMessage = {
  type: 'cheer',
  amount: 10,
  colour: '#00FF00',
  imageUrl: 'www.image.com',
  name: 'Mr Cheerer'
}

function authorToChannelInfo (a: Author, time?: Date): Omit<YoutubeChannelInfo, 'channelId' | 'id'> {
  return {
    isVerified: a.attributes.isVerified,
    isModerator: a.attributes.isModerator,
    isOwner: a.attributes.isOwner,
    imageUrl: a.image,
    name: a.name!,
    time: time ?? new Date()
  }
}

function twitchAuthorToChannelInfo (a: TwitchAuthor, time?: Date): Omit<TwitchChannelInfo, 'channelId' | 'id'> {
  return {
    time: time ?? new Date(),
    colour: a.color ?? '',
    displayName: a.displayName,
    isBroadcaster: a.isBroadcaster,
    isMod: a.isMod,
    isSubscriber: a.isSubscriber,
    isVip: a.isVip,
    userName: a.userName,
    userType: a.userType ?? ''
  }
}

function makeYtChatItem (...msg: PartialChatMessage[]): ChatItem {
  return {
    id: 'id1',
    platform: 'youtube',
    contextToken: 'params1',
    timestamp: new Date(2021, 1, 1).getTime(),
    author: ytAuthor1,
    messageParts: msg
  }
}

function makeTwitchChatItem (...msg: PartialChatMessage[]): ChatItem {
  return {
    id: 'id1',
    platform: 'twitch',
    timestamp: new Date(2021, 1, 1).getTime(),
    author: twitchAuthor,
    messageParts: msg
  }
}

export default () => {
  let mockLivestreamStore: MockProxy<LivestreamStore>
  let chatStore: ChatStore
  let db: Db
  beforeEach(async () => {
    const dbProvider = await startTestDb()

    mockLivestreamStore = mock<LivestreamStore>()
    mockGetter(mockLivestreamStore, 'activeLivestream').mockReturnValue(livestream)

    chatStore = new ChatStore(new Dependencies({
      dbProvider,
      livestreamStore: mockLivestreamStore,
      dbTransactionTimeout: 5000
    }))
    db = dbProvider.get()

    await db.youtubeChannel.create({ data: {
      user: { create: {}},
      youtubeId: ytAuthor1.channelId,
      infoHistory: { create: authorToChannelInfo(ytAuthor1)}
    }})
    await db.twitchChannel.create({ data: {
      user: { create: {}},
      twitchId: twitchAuthor.userId,
      infoHistory: { create: twitchAuthorToChannelInfo(twitchAuthor)}
    }})
    await db.youtubeChannel.create({ data: {
      user: { connect: { id: youtube1UserId }},
      youtubeId: ytAuthor2.channelId,
      infoHistory: { create: authorToChannelInfo(ytAuthor2)}
    }})
    await db.livestream.create({ data: livestream })
    await db.chatEmoji.create({ data: {
      isCustomEmoji: false,
      externalId: emoji1Saved.emojiId,
      imageUrl: emoji1Saved.image.url,
      label: emoji1Saved.label,
      name: emoji1Saved.name
    }})
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(ChatStore, 'addChat'), () => {
    test('adds youtube chat item with ordered text message parts', async () => {
      const chatItem = makeYtChatItem(text1, text2, text3)

      await chatStore.addChat(chatItem, youtube1UserId, extYoutubeChannel1)

      // check message contents
      const saved1 = (await db.chatMessagePart.findFirst({ where: { order: 0 }, select: { text: true }}))?.text?.text
      const saved2 = (await db.chatMessagePart.findFirst({ where: { order: 1 }, select: { text: true }}))?.text?.text
      const saved3 = (await db.chatMessagePart.findFirst({ where: { order: 2 }, select: { text: true }}))?.text?.text
      expect([saved1, saved2, saved3]).toEqual([text1.text, text2.text, text3.text])
      await expectRowCount(db.chatMessage, db.chatMessagePart, db.chatText).toEqual([1, 3, 3])

      // check author links
      const authors = await db.chatMessage.findFirst({ select: { userId: true, youtubeChannelId: true, twitchChannelId: true }})
      expect(authors!.userId).toBe(1)
      expect(authors!.youtubeChannelId).toBe(1)
      expect(authors!.twitchChannelId).toBeNull()
    })

    test('adds youtube chat item with message parts that reference existing emoji and new emoji', async () => {
      const chatItem = makeYtChatItem(emoji1Saved, emoji2New)

      await chatStore.addChat(chatItem, youtube1UserId, extYoutubeChannel1)

      await expectRowCount(db.chatMessage, db.chatMessagePart, db.chatEmoji).toEqual([1, 2, 2])
    })

    test('adds twitch chat item with text and cheer parts', async () => {
      const chatItem = makeTwitchChatItem(text1, cheer1)

      await chatStore.addChat(chatItem, twitchUserId, extTwitchChannel)

      // check message contents
      const saved1 = (await db.chatMessagePart.findFirst({ where: { order: 0 }, select: { text: true }}))!.text!.text
      const saved2 = (await db.chatMessagePart.findFirst({ where: { order: 1 }, select: { cheer: true }}))!.cheer!.amount
      expect(saved1).toEqual(text1.text)
      expect(saved2).toEqual(cheer1.amount)
      await expectRowCount(db.chatMessage, db.chatMessagePart, db.chatText, db.chatCheer).toEqual([1, 2, 1, 1])

      // check author links
      const authors = await db.chatMessage.findFirst({ select: { userId: true, youtubeChannelId: true, twitchChannelId: true }})
      expect(authors!.userId).toBe(2)
      expect(authors!.youtubeChannelId).toBeNull()
      expect(authors!.twitchChannelId).toBe(1)
    })

    test('duplicate chat id ignored', async () => {
      const chatItem = makeYtChatItem(text1)
      await db.chatMessage.create({ data: {
        user: { connect: { id: youtube1UserId }},
        time: new Date(chatItem.timestamp),
        externalId: chatItem.id,
        youtubeChannel: { connect: { id: 1 }},
        livestream: { connect: { id: 1 }}
      }})

      await chatStore.addChat(chatItem, youtube1UserId, extYoutubeChannel1)

      await expectRowCount(db.chatMessage).toBe(1)
    })

    test('adds chat without connecting to livestream if no active livestream', async () => {
      mockGetter(mockLivestreamStore, 'activeLivestream').mockReturnValue(null)
      const chatItem = makeYtChatItem(text1)

      await chatStore.addChat(chatItem, youtube1UserId, extYoutubeChannel1)

      const savedChatMessage = await db.chatMessage.findFirst()
      expect(savedChatMessage!.livestreamId).toBeNull()
    })
  })

  describe(nameof(ChatStore, 'getChatSince'), () => {
    test('empty database returns empty array', async () => {
      const result = await chatStore.getChatSince(new Date().getTime())

      expect(result.length).toBe(0)
    })

    test('does not include earlier items', async () => {
      const chatItem1: ChatItem = { author: ytAuthor1, id: 'id1', platform: 'youtube', contextToken: 'params1', timestamp: new Date(2021, 5, 1).getTime(), messageParts: [text1] }
      const chatItem2: ChatItem = { author: ytAuthor1, id: 'id2', platform: 'youtube', contextToken: 'params2', timestamp: new Date(2021, 5, 2).getTime(), messageParts: [text2] }
      const chatItem3: ChatItem = { author: ytAuthor1, id: 'id3', platform: 'youtube', contextToken: 'params3', timestamp: new Date(2021, 5, 3).getTime(), messageParts: [text3] }

      // cheating a little here - shouldn't be using the chatStore to initialise db, but it's too much of a maintenance debt to replicate the logic here
      await chatStore.addChat(chatItem1, youtube1UserId, extYoutubeChannel1)
      await chatStore.addChat(chatItem2, youtube1UserId, extYoutubeChannel1)
      await chatStore.addChat(chatItem3, youtube1UserId, extYoutubeChannel1)

      const result = await chatStore.getChatSince(chatItem1.timestamp)

      expect(result.map(r => r.externalId)).toEqual([chatItem2.id, chatItem3.id])
    })

    test('attaches custom emoji rank whitelist', async () => {
      const customEmojiMessage: PartialCustomEmojiChatMessage = {
        customEmojiId: 1,
        type: 'customEmoji',
        text: text1,
        emoji: null
      }
      const chatItem: ChatItem = {
        author: ytAuthor1,
        id: 'id1',
        platform: 'youtube',
        contextToken: 'params1',
        timestamp: new Date(2021, 5, 1).getTime(),
        messageParts: [customEmojiMessage]
      }

      await db.rank.createMany({ data: [
        { name: 'donator', group: 'cosmetic', displayNameAdjective: 'rank1', displayNameNoun: 'rank1' },
        { name: 'supporter', group: 'cosmetic', displayNameAdjective: 'rank2', displayNameNoun: 'rank2' },
        { name: 'member', group: 'cosmetic', displayNameAdjective: 'rank3', displayNameNoun: 'rank3' },
      ]})
      await db.customEmoji.create({ data: { symbol: 'test', image: Buffer.from(''), levelRequirement: 1, name: 'Test Emoji' }})
      await db.customEmojiRankWhitelist.createMany({ data: [
        { customEmojiId: 1, rankId: 1 },
        { customEmojiId: 1, rankId: 2 }
      ]})
      await chatStore.addChat(chatItem, youtube1UserId, extYoutubeChannel1)

      const result = await chatStore.getChatSince(0)

      const emojiResult = single(single(result).chatMessageParts).customEmoji!
      expect(emojiResult.text!.id).toBe(1)
      expect(emojiResult.customEmoji.id).toBe(1)
      expect(emojiResult.customEmoji.customEmojiRankWhitelist).toEqual([{ rankId: 1 }, { rankId: 2 }])
    })
  })

  describe(nameof(ChatStore, 'getLastChatByYoutubeChannel'), () => {
    test('returns null if youtube channel has not posted a message', async () => {
      const result = await chatStore.getLastChatByYoutubeChannel(1)

      expect(result).toBeNull()
    })

    test('returns latest chat item of channel', async () => {
      await db.chatMessage.create({ data: {
        user: { connect: { id: youtube2UserId }},
        time: data.time1,
        externalId: 'x1',
        youtubeChannel: { connect: { id: 2 }},
        livestream: { connect: { id: 1 }}
      }})
      await db.chatMessage.create({ data: {
        user: { connect: { id: youtube2UserId }},
        time: data.time2,
        externalId: 'x2',
        youtubeChannel: { connect: { id: 2 }},
        livestream: { connect: { id: 1 }}
      }})
      await db.chatMessage.create({ data: {
        user: { connect: { id: youtube1UserId }},
        time: data.time3,
        externalId: 'x3',
        youtubeChannel: { connect: { id: 1 }},
        livestream: { connect: { id: 1 }}
      }})

      const result = await chatStore.getLastChatByYoutubeChannel(2)

      expect(result!.time).toEqual(data.time2)
    })
  })

  describe(nameof(ChatStore, 'getLastChatOfUsers'), () => {
    let user3: number
    beforeEach(async () => {
      // user 3 has no chat messages
      user3 = (await db.chatUser.create({ data: {}})).id
    })

    const setupMessages = async () => {
      // user 1 now has a youtube and twitch channel
      const newExtTwitchId = 'second channel'
      await db.twitchChannel.create({ data: {
        user: { connect: { id: 1 }},
        twitchId: newExtTwitchId,
        infoHistory: { create: twitchAuthorToChannelInfo(twitchAuthor)}
      }})
      await db.chatMessage.createMany({ data: [
        // user 1:
        {
          livestreamId: 1,
          time: data.time1,
          userId: 1,
          externalId: 'user 1 msg 1',
          youtubeChannelId: 1
        }, {
          livestreamId: 1,
          time: data.time3,
          userId: 1,
          externalId: 'user 1 msg 3',
          twitchChannelId: 1
        }, {
          livestreamId: 1,
          time: data.time2,
          userId: 1,
          externalId: 'user 1 msg 2',
          youtubeChannelId: 2
        },
        
        // user 2:
        {
          livestreamId: 1,
          time: data.time2,
          userId: twitchUserId,
          externalId: 'user 2 msg 1',
          twitchChannelId: 1
        }, {
          livestreamId: 1,
          time: data.time3,
          userId: twitchUserId,
          externalId: 'user 2 msg 2',
          twitchChannelId: 1
        }
      ]})
    }
      
    test('returns empty array if no chat item exists for any users', async () => {
      const result = await chatStore.getLastChatOfUsers('all')

      expect(result.length).toBe(0)
    })
    
    test('returns empty array if no chat item exists for specified users, or users do not exist', async () => {
      await setupMessages()

      const result = await chatStore.getLastChatOfUsers([user3, 10000])

      expect(result.length).toBe(0)
    })

    test('returns the latest chat item of all users', async () => {
      await setupMessages()

      const lastMessages = await chatStore.getLastChatOfUsers('all')

      expect(lastMessages.length).toBe(2)

      const lastMessageUser1 = lastMessages.find(msg => msg.userId === 1)!
      expect(lastMessageUser1.externalId).toBe('user 1 msg 3')

      const lastMessageUser2 = lastMessages.find(msg => msg.userId === twitchUserId)!
      expect(lastMessageUser2.externalId).toBe('user 2 msg 2')
    })

    test('returns the latest chat item of a specific user', async () => {
      await setupMessages()

      const lastMessages = await chatStore.getLastChatOfUsers([1])

      const msg = single(lastMessages)
      expect(msg.externalId).toBe('user 1 msg 3')
    })
  })
}
