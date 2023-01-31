import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import ChatStore from '@rebel/server/stores/ChatStore'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { expectObject, mockGetter, nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import { Author, ChatItem, PartialChatMessage, PartialCheerChatMessage, PartialCustomEmojiChatMessage, PartialEmojiChatMessage, PartialTextChatMessage, TwitchAuthor } from '@rebel/server/models/chat'
import { YoutubeChannelInfo, Livestream, TwitchChannelInfo } from '@prisma/client'
import * as data from '@rebel/server/_test/testData'

const livestream: Livestream = {
  id: 1,
  liveId: 'liveId',
  streamerId: 1,
  continuationToken: 'token',
  createdAt: new Date(),
  start: new Date(),
  end: null,
  isActive: true,
  type: 'publicLivestream'
}

const youtube1UserId = 1
const extYoutubeChannel1 = 'channel1'
const youtube2UserId = 2
const extYoutubeChannel2 = 'channel_2'
const twitchUserId = 3
const extTwitchChannel = 'channel2'
const aggregateUserId1 = 4
const aggregateUserId2 = 5

const streamer1 = 1
const streamer2 = 2

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
  image: { url: 'emoji1.image' },
  label: 'emoji1.label',
  name: 'emoji1.name'
}
const emoji2New: PartialEmojiChatMessage = {
  type: 'emoji',
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
    mockLivestreamStore.getActiveLivestream.calledWith(livestream.streamerId).mockResolvedValue(livestream)

    chatStore = new ChatStore(new Dependencies({
      dbProvider,
      livestreamStore: mockLivestreamStore,
      dbTransactionTimeout: 5000
    }))
    db = dbProvider.get()

    await db.youtubeChannel.create({ data: {
      user: { create: {}}, // user id: 1
      youtubeId: ytAuthor1.channelId,
      infoHistory: { create: authorToChannelInfo(ytAuthor1)}
    }})
    await db.twitchChannel.create({ data: {
      user: { create: {}}, // user id: 2
      twitchId: twitchAuthor.userId,
      infoHistory: { create: twitchAuthorToChannelInfo(twitchAuthor)}
    }})
    await db.youtubeChannel.create({ data: {
      user: { create: {}},
      youtubeId: ytAuthor2.channelId,
      infoHistory: { create: authorToChannelInfo(ytAuthor2)}
    }})
    await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}}) // aggregate user id: 4
    await db.streamer.create({ data: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }}}}) // aggregate user id: 5
    await db.livestream.create({ data: livestream })
    await db.chatEmoji.create({ data: {
      isCustomEmoji: false,
      imageUrl: emoji1Saved.image.url,
      label: emoji1Saved.label,
      name: emoji1Saved.name
    }})
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(ChatStore, 'addChat'), () => {
    test('Adds youtube chat item with ordered text message parts and returns the created chat message', async () => {
      const chatItem = makeYtChatItem(text1, text2, text3)

      const result = await chatStore.addChat(chatItem, livestream.streamerId, youtube1UserId, extYoutubeChannel1)

      // check message contents
      const saved1 = (await db.chatMessagePart.findFirst({ where: { order: 0 }, select: { text: true }}))?.text?.text
      const saved2 = (await db.chatMessagePart.findFirst({ where: { order: 1 }, select: { text: true }}))?.text?.text
      const saved3 = (await db.chatMessagePart.findFirst({ where: { order: 2 }, select: { text: true }}))?.text?.text
      expect([saved1, saved2, saved3]).toEqual([text1.text, text2.text, text3.text])
      await expectRowCount(db.chatMessage, db.chatMessagePart, db.chatText).toEqual([1, 3, 3])

      // check author links
      const chatMessage = await db.chatMessage.findFirst()
      expect(chatMessage!.userId).toBe(1)
      expect(chatMessage!.youtubeChannelId).toBe(1)
      expect(chatMessage!.twitchChannelId).toBeNull()
      expect(result).toEqual(expectObject(chatMessage!))
    })

    test('adds youtube chat item with message parts that reference existing emoji and new emoji', async () => {
      const chatItem = makeYtChatItem(emoji1Saved, emoji2New)

      const result = await chatStore.addChat(chatItem, livestream.streamerId, youtube1UserId, extYoutubeChannel1)

      const savedChatMessage = await db.chatMessage.findFirst()
      expect(result).toEqual(expectObject(savedChatMessage!))
      await expectRowCount(db.chatMessage, db.chatMessagePart, db.chatEmoji).toEqual([1, 2, 2])
    })

    test('adds twitch chat item with text and cheer parts', async () => {
      const chatItem = makeTwitchChatItem(text1, cheer1)

      const result = await chatStore.addChat(chatItem, livestream.streamerId, twitchUserId, extTwitchChannel)

      // check message contents
      const saved1 = (await db.chatMessagePart.findFirst({ where: { order: 0 }, select: { text: true }}))!.text!.text
      const saved2 = (await db.chatMessagePart.findFirst({ where: { order: 1 }, select: { cheer: true }}))!.cheer!.amount
      expect(saved1).toEqual(text1.text)
      expect(saved2).toEqual(cheer1.amount)
      await expectRowCount(db.chatMessage, db.chatMessagePart, db.chatText, db.chatCheer).toEqual([1, 2, 1, 1])

      // check author links
      const chatMessage = await db.chatMessage.findFirst()
      expect(chatMessage!.userId).toBe(twitchUserId)
      expect(chatMessage!.youtubeChannelId).toBeNull()
      expect(chatMessage!.twitchChannelId).toBe(1)
      expect(result).toEqual(expectObject(chatMessage!))
    })

    test('duplicate chat id ignored', async () => {
      const chatItem = makeYtChatItem(text1)
      await db.chatMessage.create({ data: {
        streamer: { connect: { id: streamer1, }},
        user: { connect: { id: youtube1UserId }},
        time: new Date(chatItem.timestamp),
        externalId: chatItem.id,
        youtubeChannel: { connect: { id: 1 }},
        livestream: { connect: { id: 1 }}
      }})

      const result = await chatStore.addChat(chatItem, livestream.streamerId, youtube1UserId, extYoutubeChannel1)

      await expectRowCount(db.chatMessage).toBe(1)
      const savedChatMessage = await db.chatMessage.findFirst()
      expect(result).toEqual(expectObject(savedChatMessage!))
    })

    test('adds chat without connecting to livestream if no active livestream', async () => {
      mockLivestreamStore.getActiveLivestream.mockReset().calledWith(livestream.streamerId).mockResolvedValue(null)
      const chatItem = makeYtChatItem(text1)

      const result = await chatStore.addChat(chatItem, livestream.streamerId, youtube1UserId, extYoutubeChannel1)

      const savedChatMessage = await db.chatMessage.findFirst()
      expect(savedChatMessage!.livestreamId).toBeNull()
      expect(result).toEqual(expectObject(savedChatMessage!))
    })
  })

  describe(nameof(ChatStore, 'getChatSince'), () => {
    test('empty database returns empty array', async () => {
      const result = await chatStore.getChatSince(streamer1, new Date().getTime())

      expect(result.length).toBe(0)
    })

    test('does not include earlier items or items from other streamers', async () => {
      const chatItem1: ChatItem = { author: ytAuthor1, id: 'id1', platform: 'youtube', contextToken: 'params1', timestamp: new Date(2021, 5, 1).getTime(), messageParts: [text1] }
      const chatItem2: ChatItem = { author: ytAuthor1, id: 'id2', platform: 'youtube', contextToken: 'params2', timestamp: new Date(2021, 5, 2).getTime(), messageParts: [text2] }
      const chatItem3: ChatItem = { author: ytAuthor1, id: 'id3', platform: 'youtube', contextToken: 'params3', timestamp: new Date(2021, 5, 3).getTime(), messageParts: [text3] }
      const chatItem4: ChatItem = { author: ytAuthor1, id: 'id4', platform: 'youtube', contextToken: 'params4', timestamp: new Date(2021, 5, 3).getTime(), messageParts: [text3] }

      // cheating a little here - shouldn't be using the chatStore to initialise db, but it's too much of a maintenance debt to replicate the logic here
      await chatStore.addChat(chatItem1, streamer1, youtube1UserId, extYoutubeChannel1)
      await chatStore.addChat(chatItem2, streamer1, youtube1UserId, extYoutubeChannel1)
      await chatStore.addChat(chatItem3, streamer1, youtube1UserId, extYoutubeChannel1)
      await chatStore.addChat(chatItem4, streamer2, youtube1UserId, extYoutubeChannel1)

      const result = await chatStore.getChatSince(streamer1, chatItem1.timestamp)

      expect(result.map(r => r.externalId)).toEqual([chatItem2.id, chatItem3.id])
    })

    test('only returns results before or at the given timestamp, if set', async () => {
      const chatItem1: ChatItem = { author: ytAuthor1, id: 'id1', platform: 'youtube', contextToken: 'params1', timestamp: new Date(2021, 5, 1).getTime(), messageParts: [text1] }
      const chatItem2: ChatItem = { author: ytAuthor1, id: 'id2', platform: 'youtube', contextToken: 'params2', timestamp: new Date(2021, 5, 2).getTime(), messageParts: [text2] }
      const chatItem3: ChatItem = { author: ytAuthor1, id: 'id3', platform: 'youtube', contextToken: 'params3', timestamp: new Date(2021, 5, 3).getTime(), messageParts: [text3] }
      const chatItem4: ChatItem = { author: ytAuthor1, id: 'id4', platform: 'youtube', contextToken: 'params4', timestamp: new Date(2021, 5, 4).getTime(), messageParts: [text3] }

      // cheating a little here - shouldn't be using the chatStore to initialise db, but it's too much of a maintenance debt to replicate the logic here
      await chatStore.addChat(chatItem1, streamer1, youtube1UserId, extYoutubeChannel1)
      await chatStore.addChat(chatItem2, streamer1, youtube1UserId, extYoutubeChannel1)
      await chatStore.addChat(chatItem3, streamer1, youtube1UserId, extYoutubeChannel1)
      await chatStore.addChat(chatItem4, streamer1, youtube1UserId, extYoutubeChannel1)

      const result = await chatStore.getChatSince(streamer1, chatItem1.timestamp, chatItem3.timestamp)

      expect(result.map(r => r.externalId)).toEqual([chatItem2.id, chatItem3.id])
    })

    test('only returns the first N results as specified by the limit, if set', async () => {
      const chatItem1: ChatItem = { author: ytAuthor1, id: 'id1', platform: 'youtube', contextToken: 'params1', timestamp: new Date(2021, 5, 1).getTime(), messageParts: [text1] }
      const chatItem2: ChatItem = { author: ytAuthor1, id: 'id2', platform: 'youtube', contextToken: 'params2', timestamp: new Date(2021, 5, 2).getTime(), messageParts: [text2] }
      const chatItem3: ChatItem = { author: ytAuthor1, id: 'id3', platform: 'youtube', contextToken: 'params3', timestamp: new Date(2021, 5, 3).getTime(), messageParts: [text3] }
      const chatItem4: ChatItem = { author: ytAuthor1, id: 'id4', platform: 'youtube', contextToken: 'params4', timestamp: new Date(2021, 5, 4).getTime(), messageParts: [text3] }

      // cheating a little here - shouldn't be using the chatStore to initialise db, but it's too much of a maintenance debt to replicate the logic here
      await chatStore.addChat(chatItem1, streamer1, youtube1UserId, extYoutubeChannel1)
      await chatStore.addChat(chatItem2, streamer1, youtube1UserId, extYoutubeChannel1)
      await chatStore.addChat(chatItem3, streamer1, youtube1UserId, extYoutubeChannel1)
      await chatStore.addChat(chatItem4, streamer1, youtube1UserId, extYoutubeChannel1)

      const result = await chatStore.getChatSince(streamer1, chatItem1.timestamp, undefined, 2)

      expect(result.map(r => r.externalId)).toEqual([chatItem3.id, chatItem4.id])
    })

    test('attaches custom emoji rank whitelist', async () => {
      const customEmojiMessage: PartialCustomEmojiChatMessage = {
        customEmojiId: 1,
        customEmojiVersion: 0,
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
      await db.customEmojiVersion.create({ data: {
        image: Buffer.from(''),
        levelRequirement: 1,
        name: 'Test Emoji',
        isActive: true,
        version: 0,
        canUseInDonationMessage: true,
        customEmoji: { create: { streamerId: streamer1, symbol: 'test' }}
      }})
      await db.customEmojiRankWhitelist.createMany({ data: [
        { customEmojiId: 1, rankId: 1 },
        { customEmojiId: 1, rankId: 2 }
      ]})
      await chatStore.addChat(chatItem, streamer1, youtube1UserId, extYoutubeChannel1)

      const result = await chatStore.getChatSince(streamer1, 0)

      const emojiResult = single(single(result).chatMessageParts).customEmoji!
      expect(emojiResult.text!.id).toBe(1)
      expect(emojiResult.customEmojiVersion.customEmojiId).toBe(1)
      expect(emojiResult.customEmojiVersion.customEmoji.customEmojiRankWhitelist).toEqual([{ rankId: 1 }, { rankId: 2 }])
    })

    test('ignores donation messages', async () => {
      const donation = await db.donation.create({ data: {
        amount: 1,
        currency: 'USD',
        formattedAmount: '$1.00',
        name: 'Test user',
        streamlabsId: 1,
        time: data.time1,
        streamerId: streamer1
      }})
      await db.chatText.create({ data: { isBold: false, isItalics: false, text: 'sample text' }})
      await db.chatMessage.create({ data: {
        streamerId: streamer1,
        externalId: '1',
        time: new Date(),
        donationId: donation.id,
        chatMessageParts: { createMany: { data: [{ order: 0, textId: 1 }]}}
      }})

      const result = await chatStore.getChatSince(streamer1, 0)

      expect(result.length).toBe(0)
    })
  })

  describe(nameof(ChatStore, 'getLastChatByYoutubeChannel'), () => {
    test('returns null if youtube channel has not posted a message', async () => {
      const result = await chatStore.getLastChatByYoutubeChannel(streamer1, 1)

      expect(result).toBeNull()
    })

    test('returns latest chat item of channel for the specified streamer', async () => {
      await db.chatMessage.create({ data: {
        streamer: { connect: { id: streamer1, }},
        user: { connect: { id: youtube2UserId }},
        time: data.time1, // earlier time
        externalId: 'x1',
        youtubeChannel: { connect: { id: 2 }},
        livestream: { connect: { id: 1 }}
      }})
      await db.chatMessage.create({ data: {
        streamer: { connect: { id: streamer1, }},
        user: { connect: { id: youtube2UserId }},
        time: data.time2,
        externalId: 'x2',
        youtubeChannel: { connect: { id: 2 }},
        livestream: { connect: { id: 1 }}
      }})
      await db.chatMessage.create({ data: {
        streamer: { connect: { id: streamer1, }},
        user: { connect: { id: youtube1UserId }},
        time: data.time3,
        externalId: 'x3',
        youtubeChannel: { connect: { id: 1 }}, // different channel
        livestream: { connect: { id: 1 }}
      }})
      await db.chatMessage.create({ data: {
        streamer: { connect: { id: streamer2, }}, // different streamer
        user: { connect: { id: youtube2UserId }},
        time: data.time2,
        externalId: 'x4',
        youtubeChannel: { connect: { id: 2 }},
        livestream: { connect: { id: 1 }}
      }})

      const result = await chatStore.getLastChatByYoutubeChannel(streamer1, 2)

      expect(result!.time).toEqual(data.time2)
    })
  })

  describe(nameof(ChatStore, 'getLastChatOfUsers'), () => {
    // link all users to the first aggregateUser
    let user3: number
    beforeEach(async () => {
      // user 3 has no chat messages in streamer 1
      user3 = (await db.chatUser.create({ data: { aggregateChatUserId: aggregateUserId1 }})).id
      await db.chatUser.update({ where: { id: youtube1UserId }, data: { aggregateChatUserId: aggregateUserId1 }})
      await db.chatUser.update({ where: { id: youtube2UserId }, data: { aggregateChatUserId: aggregateUserId1 }})
      await db.chatUser.update({ where: { id: twitchUserId }, data: { aggregateChatUserId: aggregateUserId1 }})
    })

    const setupMessages = async () => {
      await db.chatMessage.createMany({ data: [
        // user 1:
        {
          livestreamId: 1,
          streamerId: streamer1,
          time: data.time1,
          userId: youtube1UserId,
          externalId: 'user 1 msg 1',
          youtubeChannelId: 1
        }, {
          livestreamId: 1,
          streamerId: streamer1,
          time: data.time3,
          userId: youtube1UserId,
          externalId: 'user 1 msg 3',
          twitchChannelId: 1
        }, {
          livestreamId: 1,
          streamerId: streamer1,
          time: data.time2,
          userId: youtube1UserId,
          externalId: 'user 1 msg 2',
          youtubeChannelId: 2
        },

        // user 2:
        {
          livestreamId: 1,
          streamerId: streamer1,
          time: data.time2,
          userId: twitchUserId,
          externalId: 'user 2 msg 1',
          twitchChannelId: 1
        }, {
          livestreamId: 1,
          streamerId: streamer1,
          time: data.time4,
          userId: twitchUserId,
          externalId: 'user 2 msg 2',
          twitchChannelId: 1
        },

        // user 3:
        {
          livestreamId: 1,
          streamerId: streamer2, // different streamer
          time: data.time2,
          userId: user3,
          externalId: 'user 3 msg 1',
          youtubeChannelId: 1
        }
      ]})
    }

    test('Throws if no chat message was found for the stream for any of the given users', async () => {
      await setupMessages()

      await expect(() => chatStore.getLastChatOfUsers(streamer1, [user3])).rejects.toThrow()
    })

    test('returns the latest chat item of all default users in the streamer context', async () => {
      await setupMessages()

      const lastMessages = await chatStore.getLastChatOfUsers(streamer1, [youtube1UserId, twitchUserId])

      expect(lastMessages.length).toBe(2)

      const lastMessageUser1 = lastMessages.find(msg => msg.userId === youtube1UserId)!
      expect(lastMessageUser1.externalId).toBe('user 1 msg 3')

      const lastMessageUser2 = lastMessages.find(msg => msg.userId === twitchUserId)!
      expect(lastMessageUser2.externalId).toBe('user 2 msg 2')
    })

    test('returns the latest chat item of a specific default user', async () => {
      await setupMessages()

      const lastMessages = await chatStore.getLastChatOfUsers(streamer1, [1])

      const msg = single(lastMessages)
      expect(msg.externalId).toBe('user 1 msg 3')
    })

    test('returns the latest chat item out of all channels attached to an aggregate user', async () => {
      await setupMessages()
      await db.chatUser.update({ where: { id: 1 }, data: { aggregateChatUserId: aggregateUserId1 }})
      await db.chatUser.update({ where: { id: 2 }, data: { aggregateChatUserId: aggregateUserId1 }})

      const lastMessages = await chatStore.getLastChatOfUsers(streamer1, [aggregateUserId1])

      expect(lastMessages.length).toBe(1)
      expect(lastMessages[0].user!.aggregateChatUserId).toBe(aggregateUserId1)
      expect(lastMessages[0].userId).toBe(twitchUserId)
      expect(lastMessages[0].externalId).toBe('user 2 msg 2')
    })

    test('ignores donation messages', async () => {
      const donation = await db.donation.create({ data: {
        amount: 1,
        currency: 'USD',
        formattedAmount: '$1.00',
        name: 'Test user',
        streamlabsId: 1,
        time: data.time1,
        streamerId: streamer1
      }})
      await db.chatText.create({ data: { isBold: false, isItalics: false, text: 'sample text' }})
      // no user attached to donation messages
      await db.chatMessage.create({ data: {
        streamerId: streamer1,
        externalId: '1',
        time: new Date(),
        donationId: donation.id,
        chatMessageParts: { createMany: { data: [{ order: 0, textId: 1 }]}}
      }})

      await expect(() => chatStore.getLastChatOfUsers(streamer1, [1, 2])).rejects.toThrow()
    })
  })

  describe(nameof(ChatStore, 'getChatById'), () => {
    test('Gets chat message by id', async () => {
      const chatItem1 = makeYtChatItem(text1)
      const chatItem2 = { ...makeYtChatItem(text2), id: 'id2' }
      await chatStore.addChat(chatItem1, livestream.streamerId, youtube1UserId, extYoutubeChannel1)
      await chatStore.addChat(chatItem2, livestream.streamerId, youtube1UserId, extYoutubeChannel1)

      const result = await chatStore.getChatById(2)

      expect(result.id).toBe(2)
      expect(single(result.chatMessageParts).text!.text).toBe(text2.text)
    })

    test('Throws if not found', async () => {
      const chatItem1 = makeYtChatItem(text1)
      await chatStore.addChat(chatItem1, livestream.streamerId, youtube1UserId, extYoutubeChannel1)

      await expect(() => chatStore.getChatById(2)).rejects.toThrow()
    })
  })
}
