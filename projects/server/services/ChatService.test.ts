import { Dependencies } from '@rebel/shared/context/context'
import { ChatItem, ChatItemWithRelations, PartialCustomEmojiChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import ChatService, { INACCESSIBLE_EMOJI } from '@rebel/server/services/ChatService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import LogService from '@rebel/server/services/LogService'
import ChannelStore, { YoutubeChannelWithLatestInfo, TwitchChannelWithLatestInfo } from '@rebel/server/stores/ChannelStore'
import ChatStore, { AddedChatMessage } from '@rebel/server/stores/ChatStore'
import { cast, expectArray, expectObject, nameof, promised } from '@rebel/shared/testUtils'
import { single, single2 } from '@rebel/shared/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import CustomEmojiService from '@rebel/server/services/CustomEmojiService'
import EventDispatchService, { EVENT_CHAT_ITEM, EVENT_CHAT_ITEM_REMOVED, EVENT_PUBLIC_CHAT_ITEM, EVENT_PUBLIC_CHAT_MATE_EVENT_MESSAGE_DELETED, EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_VIEWER } from '@rebel/server/services/EventDispatchService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { ChatMessage, YoutubeLivestream, TwitchLivestream } from '@prisma/client'
import CommandService, { NormalisedCommand } from '@rebel/server/services/command/CommandService'
import CommandStore from '@rebel/server/stores/CommandStore'
import CommandHelpers from '@rebel/server/helpers/CommandHelpers'
import ChannelEventService from '@rebel/server/services/ChannelEventService'
import EmojiService from '@rebel/server/services/EmojiService'
import ChannelService from '@rebel/server/services/ChannelService'

const textPart: PartialTextChatMessage = {
  type: 'text',
  text: 'text',
  isBold: false,
  isItalics: false
}
const emojiPart: PartialEmojiChatMessage = {
  type: 'emoji',
  name: 'emoji name',
  url: 'url',
  label: 'emoji label'
}
const customEmojiPart: PartialCustomEmojiChatMessage = {
  type: 'customEmoji',
  customEmojiId: 1,
  customEmojiVersion: 1,
  text: textPart,
  emoji: null,
  processedEmoji: null
}
const chatItem1: ChatItem = {
  id: 'youtube_id1',
  platform: 'youtube',
  contextToken: 'params1',
  author: data.author1,
  messageParts: [textPart, emojiPart],
  timestamp: data.time1.getTime()
}
const chatItem2: ChatItem = {
  id: 'twitch_id1',
  platform: 'twitch',
  author: data.author3,
  messageParts: [textPart, emojiPart],
  timestamp: data.time1.getTime()
}

const youtubeChannel1: YoutubeChannelWithLatestInfo = {
  id: 10,
  userId: 1,
  youtubeId: data.youtubeChannel1,
  globalInfoHistory: [{ ...data.youtubeChannelGlobalInfo1, id: 1, channelId: 1, imageId: 1 }]
}
const twitchChannel1: TwitchChannelWithLatestInfo = {
  id: 20,
  userId: 3,
  twitchId: data.twitchChannel3,
  globalInfoHistory: [{ ...data.twitchChannelGlobalInfo3, id: 2, channelId: 2 }]
}

let mockChatStore: MockProxy<ChatStore>
let mockLogService: MockProxy<LogService>
let mockExperienceService: MockProxy<ExperienceService>
let mockCustomEmojiService: MockProxy<CustomEmojiService>
let mockEventDispatchService: MockProxy<EventDispatchService>
let mockLivestreamStore: MockProxy<LivestreamStore>
let mockCommandService: MockProxy<CommandService>
let mockCommandHelpers: MockProxy<CommandHelpers>
let mockCommandStore: MockProxy<CommandStore>
let mockChannelEventService: MockProxy<ChannelEventService>
let mockEmojiService: MockProxy<EmojiService>
let mockChannelService: MockProxy<ChannelService>
let chatService: ChatService

beforeEach(() => {
  mockChatStore = mock()
  mockLogService = mock()
  mockExperienceService = mock()
  mockCustomEmojiService = mock()
  mockEventDispatchService = mock()
  mockLivestreamStore = mock()
  mockCommandService = mock()
  mockCommandHelpers = mock()
  mockCommandStore = mock()
  mockChannelEventService = mock()
  mockEmojiService = mock()
  mockChannelService = mock()

  chatService = new ChatService(new Dependencies({
    chatStore: mockChatStore,
    logService: mockLogService,
    experienceService: mockExperienceService,
    customEmojiService: mockCustomEmojiService,
    eventDispatchService: mockEventDispatchService,
    livestreamStore: mockLivestreamStore,
    commandHelpers: mockCommandHelpers,
    commandService: mockCommandService,
    commandStore: mockCommandStore,
    channelEventService: mockChannelEventService,
    emojiService: mockEmojiService,
    channelService: mockChannelService
  }))
})

describe(nameof(ChatService, 'initialise'), () => {
  test('subscribes to chatItem and messageDeleted events', () => {
    chatService.initialise()

    const args = mockEventDispatchService.onData.mock.calls
    expect(args.length).toBe(2)
    expect(args[0][0]).toBe(EVENT_CHAT_ITEM)
    expect(args[0][1]).not.toBeNull()
    expect(args[1][0]).toBe(EVENT_CHAT_ITEM_REMOVED)
    expect(args[1][1]).not.toBeNull()
  })
})

describe(nameof(ChatService, 'getChatById'), () => {
  test('Returns the specified chat message with signed emoji images', async () => {
    const streamerId = 51
    const chatMessageId = 454
    const userId = 5
    const parts = cast<ChatItemWithRelations['chatMessageParts']>([{ emoji: {} }])
    const chat = cast<ChatItemWithRelations>({
      streamerId: streamerId,
      user: { id: userId },
      chatMessageParts: parts
    })

    mockChatStore.getChatById.calledWith(chatMessageId).mockResolvedValue(chat)
    mockEmojiService.getEligibleEmojiUsers.calledWith(streamerId).mockResolvedValue([userId])

    const result = await chatService.getChatById(chatMessageId)

    expect(result).toBe(chat)
    expect(single2(mockCustomEmojiService.signEmojiImages.mock.calls)).toBe(parts)
    expect(single2(mockEmojiService.signEmojiImages.mock.calls)).toBe(parts)
  })

  test('Marks emojis as inaccessible if the user is not eligible for public emojis', async () => {
    const streamerId = 51
    const chatMessageId = 454
    const userId = 5
    const parts = cast<ChatItemWithRelations['chatMessageParts']>([{ emoji: { image: {} } }])
    const chat = cast<ChatItemWithRelations>({
      streamerId: streamerId,
      user: { id: userId },
      chatMessageParts: parts
    })

    mockChatStore.getChatById.calledWith(chatMessageId).mockResolvedValue(chat)
    mockEmojiService.getEligibleEmojiUsers.calledWith(streamerId).mockResolvedValue([userId + 1])

    const result = await chatService.getChatById(chatMessageId)

    expect(result).toBe(chat)
    expect(result.chatMessageParts[0].emoji!.imageUrl).toBe(INACCESSIBLE_EMOJI)
    expect(single2(mockCustomEmojiService.signEmojiImages.mock.calls)).toBe(parts)
    expect(mockEmojiService.signEmojiImages.mock.calls.length).toBe(0)
  })
})

describe(nameof(ChatService, 'getChatSince'), () => {
  test('Returns chat messages with signed custom emoji images', async () => {
    const streamerId = 4
    const since = 1234
    const beforeOrAt = 5678
    const limit = 5
    const userIds = [1, 3]
    const deletedOnly = true
    const parts1 = cast<ChatItemWithRelations['chatMessageParts']>([])
    const parts2 = cast<ChatItemWithRelations['chatMessageParts']>([])
    const chat1 = cast<ChatItemWithRelations>({ chatMessageParts: parts1 })
    const chat2 = cast<ChatItemWithRelations>({ chatMessageParts: parts2 })

    mockChatStore.getChatSince.calledWith(streamerId, since, beforeOrAt, limit, userIds, deletedOnly).mockResolvedValue([chat1, chat2])

    const result = await chatService.getChatSince(streamerId, since, beforeOrAt, limit, userIds, deletedOnly)

    expect(result).toEqual(expectArray(result, [chat1, chat2]))
    const signCalls = mockCustomEmojiService.signEmojiImages.mock.calls.map(single)
    expect(signCalls).toEqual(expectArray(signCalls, [parts1, parts2]))
  })

  test('Removes emoji information for those users that are not eligible', async () => {
    const streamerId = 3
    const primaryUser1 = 51
    const primaryUser2 = 658
    const primaryUser3 = 65
    const since = 1234
    const beforeOrAt = 5678
    const limit = 5
    const userIds = [1, 3]
    const deletedOnly = true

    const chat1 = cast<ChatItemWithRelations>({
      user: { id: primaryUser3, aggregateChatUserId: primaryUser3 }, // not eligible
      chatMessageParts: [{ emoji: { imageUrl: 'url1', image: {} }}, { customEmoji: { emoji: { imageUrl: 'url2', image: {} }}}]
    })
    const chat2 = cast<ChatItemWithRelations>({
      user: { id: primaryUser1, aggregateChatUserId: primaryUser1 }, // eligible
      chatMessageParts: [{ emoji: { imageUrl: 'url3' }}, { customEmoji: { emoji: { imageUrl: 'url4'}}}]
    })
    const chatItems = [chat1, chat2]

    mockEmojiService.getEligibleEmojiUsers.calledWith(streamerId).mockResolvedValue([primaryUser1, primaryUser2])
    mockChatStore.getChatSince.calledWith(streamerId, since, beforeOrAt, limit, userIds, deletedOnly).mockResolvedValue(chatItems)

    const result = await chatService.getChatSince(streamerId, since, beforeOrAt, limit, userIds, deletedOnly)

    expect(result).toBe(chatItems)

    const signCalls = mockEmojiService.signEmojiImages.mock.calls
    expect(signCalls.length).toBe(2)
    expect(single(signCalls[0])).toBe(chat1.chatMessageParts)
    expect(single(signCalls[1])).toBe(chat2.chatMessageParts)

    expect(result[0].chatMessageParts[0].emoji!.imageUrl).toBe(INACCESSIBLE_EMOJI)
    expect(result[0].chatMessageParts[1].customEmoji!.emoji!.imageUrl).toBe(INACCESSIBLE_EMOJI)
    expect(result[1].chatMessageParts[0].emoji!.imageUrl).toBe('url3')
    expect(result[1].chatMessageParts[1].customEmoji!.emoji!.imageUrl).toBe('url4')
  })
})

describe(nameof(ChatService, 'onChatItemDeleted'), () => {
  test('Removes the chat item, fires event if deleted', async () => {
    const externalMessageId = 'messageId'
    const streamerId = 5123
    const chatMessageId = 5
    mockChatStore.deleteChat.calledWith(externalMessageId).mockResolvedValue(cast<ChatMessage>({ id: chatMessageId, streamerId }))

    await chatService.onChatItemDeleted(externalMessageId)

    const providedMessageId = single2(mockChatStore.deleteChat.mock.calls)
    expect(providedMessageId).toBe(externalMessageId)

    const eventCall = single(mockEventDispatchService.addData.mock.calls)
    expect(eventCall).toEqual(expectObject(eventCall, [EVENT_PUBLIC_CHAT_MATE_EVENT_MESSAGE_DELETED, { streamerId, chatMessageId }]))
  })

  test('Removes the chat item, does not fire event if not deleted', async () => {
    const externalMessageId = 'messageId'
    const streamerId = 5123
    const chatMessageId = 5
    mockChatStore.deleteChat.calledWith(externalMessageId).mockResolvedValue(null)

    await chatService.onChatItemDeleted(externalMessageId)

    const providedMessageId = single2(mockChatStore.deleteChat.mock.calls)
    expect(providedMessageId).toBe(externalMessageId)

    expect(mockEventDispatchService.addData.mock.calls.length).toBe(0)
  })
})

describe(nameof(ChatService, 'onNewChatItem'), () => {
  test('youtube: synthesises correct data and calls required services, then returns true. Emits new viewer event', async () => {
    const streamerId = 2
    const primaryUserId = 5
    const newMessageId = 5152
    const addedChatMessage = cast<AddedChatMessage>({ id: newMessageId, user: { id: primaryUserId }})
    const livestream = cast<YoutubeLivestream>({})

    mockChannelService.createOrUpdateYoutubeChannel.calledWith(data.youtubeChannel1, expect.objectContaining(data.youtubeChannelGlobalInfo1)).mockResolvedValue(youtubeChannel1)
    mockChatStore.addChat.calledWith(chatItem1, streamerId, youtubeChannel1.userId, youtubeChannel1.youtubeId).mockResolvedValue(addedChatMessage)
    mockCustomEmojiService.applyCustomEmojis.calledWith(expectArray([textPart, emojiPart]), youtubeChannel1.userId, streamerId).mockResolvedValue([textPart, customEmojiPart, emojiPart])
    mockEmojiService.processEmoji.mockImplementation(part => Promise.resolve(part))
    mockCommandHelpers.extractNormalisedCommand.calledWith(expect.arrayContaining([textPart, customEmojiPart, emojiPart])).mockReturnValue(null)
    mockLivestreamStore.getActiveYoutubeLivestream.calledWith(streamerId).mockResolvedValue(livestream)
    mockChatStore.getTimeOfFirstChat.calledWith(streamerId, expectArray([primaryUserId])).mockResolvedValue([{ messageId: newMessageId, primaryUserId, firstSeen: 0 }])

    const addedChat = await chatService.onNewChatItem(chatItem1, streamerId)

    expect(addedChat).toBe(true)

    expect(mockEventDispatchService.addData.mock.calls.length).toBe(2)
    const [newViewerArgs, chatItemArgs] = mockEventDispatchService.addData.mock.calls
    expect(newViewerArgs).toEqual(expectObject(newViewerArgs, [EVENT_PUBLIC_CHAT_MATE_EVENT_NEW_VIEWER, { streamerId, primaryUserId }]))
    expect(chatItemArgs).toEqual(expectObject(chatItemArgs, [EVENT_PUBLIC_CHAT_ITEM, addedChatMessage]))

    const [passedChatItem_, passedStreamerId_] = single(mockExperienceService.addExperienceForChat.mock.calls)
    expect(passedChatItem_).toBe(chatItem1)
    expect(passedStreamerId_).toBe(streamerId)

    const channelEventServiceArgs = single(mockChannelEventService.checkYoutubeChannelForModEvent.mock.calls)
    expect(channelEventServiceArgs).toEqual<typeof channelEventServiceArgs>([streamerId, youtubeChannel1.id])
  })

  test('twitch: synthesises correct data and calls required services, then returns true. Does not emit new viewer event', async () => {
    const streamerId = 2
    const primaryUserId = 5
    const newMessageId = 5152
    const addedChatMessage = cast<AddedChatMessage>({ id: newMessageId, user: { id: primaryUserId }})
    const livestream = cast<TwitchLivestream>({})

    mockChannelService.createOrUpdateTwitchChannel.calledWith(data.twitchChannel3, expect.objectContaining(data.twitchChannelGlobalInfo3)).mockResolvedValue(twitchChannel1)
    mockChatStore.addChat.calledWith(chatItem2, streamerId, twitchChannel1.userId, twitchChannel1.twitchId).mockResolvedValue(addedChatMessage)
    mockCustomEmojiService.applyCustomEmojis.calledWith(expectArray([textPart, emojiPart]), twitchChannel1.userId, streamerId).mockResolvedValue([textPart, customEmojiPart, emojiPart])
    mockEmojiService.processEmoji.mockImplementation(part => Promise.resolve(part))
    mockCommandHelpers.extractNormalisedCommand.calledWith(expect.arrayContaining([textPart, customEmojiPart, emojiPart])).mockReturnValue(null)
    mockLivestreamStore.getCurrentTwitchLivestream.calledWith(streamerId).mockResolvedValue(livestream)
    mockChatStore.getTimeOfFirstChat.calledWith(streamerId, expectArray([primaryUserId])).mockResolvedValue([{ firstSeen: 0, primaryUserId, messageId: -1 }])

    const addedChat = await chatService.onNewChatItem(chatItem2, streamerId)

    expect(addedChat).toBe(true)

    const chatItemArgs = single(mockEventDispatchService.addData.mock.calls)
    expect(chatItemArgs).toEqual(expectObject(chatItemArgs, [EVENT_PUBLIC_CHAT_ITEM, addedChatMessage]))

    const [passedChatItem_, passedStreamerId_] = single(mockExperienceService.addExperienceForChat.mock.calls)
    expect(passedChatItem_).toBe(chatItem2)
    expect(passedStreamerId_).toBe(streamerId)
  })

  test('Executes command and does not perform normal chat side effects', async () => {
    const streamerId = 2
    const primaryUserId = 5
    const addedChatMessage = cast<AddedChatMessage>({ id: 56, user: { id: primaryUserId }})
    const command: NormalisedCommand = { normalisedName: 'TEST' }
    const commandId = 5

    mockChannelService.createOrUpdateTwitchChannel.calledWith(data.twitchChannel3, expect.objectContaining(data.twitchChannelGlobalInfo3)).mockResolvedValue(twitchChannel1)
    mockCustomEmojiService.applyCustomEmojis.mockImplementation(parts => Promise.resolve(parts))
    mockEmojiService.processEmoji.mockImplementation(part => Promise.resolve(part))
    mockChatStore.addChat.calledWith(chatItem2, streamerId, twitchChannel1.userId, twitchChannel1.twitchId).mockResolvedValue(addedChatMessage)
    mockCommandHelpers.extractNormalisedCommand.calledWith(expect.arrayContaining(chatItem2.messageParts)).mockReturnValue(command)
    mockCommandStore.addCommand.calledWith(addedChatMessage.id, command).mockResolvedValue(commandId)
    mockChatStore.getTimeOfFirstChat.calledWith(streamerId, expectArray([primaryUserId])).mockResolvedValue([{ firstSeen: 0, primaryUserId, messageId: -1 }])

    const addedChat = await chatService.onNewChatItem(chatItem2, streamerId)

    expect(addedChat).toBe(true)

    const chatItemArgs = single(mockEventDispatchService.addData.mock.calls)
    expect(chatItemArgs).toEqual(expectObject(chatItemArgs, [EVENT_PUBLIC_CHAT_ITEM, addedChatMessage]))

    expect(single(mockCommandService.queueCommandExecution.mock.calls)).toEqual([commandId])
    expect(mockExperienceService.addExperienceForChat.mock.calls.length).toBe(0)
  })

  test('returns false if chat item already exists, and does not attempt to call services', async () => {
    const streamerId = 2
    mockChannelService.createOrUpdateYoutubeChannel.calledWith(data.youtubeChannel1, expect.objectContaining(data.youtubeChannelGlobalInfo1)).mockResolvedValue(youtubeChannel1)
    mockCustomEmojiService.applyCustomEmojis.mockImplementation((parts) => promised(parts))
    mockEmojiService.processEmoji.mockImplementation(part => Promise.resolve(part))
    mockChatStore.addChat.calledWith(chatItem1, streamerId, youtubeChannel1.userId, youtubeChannel1.youtubeId).mockResolvedValue(null)

    const addedChat = await chatService.onNewChatItem(chatItem1, streamerId)

    expect(addedChat).toBe(false)

    expect(mockEventDispatchService.addData.mock.calls.length).toBe(0)

    expect(mockExperienceService.addExperienceForChat.mock.calls.length).toBe(0)

    const channelEventServiceArgs = single(mockChannelEventService.checkYoutubeChannelForModEvent.mock.calls)
    expect(channelEventServiceArgs).toEqual<typeof channelEventServiceArgs>([streamerId, youtubeChannel1.id])
  })
})
