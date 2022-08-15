import { Dependencies } from '@rebel/server/context/context'
import { ChatItem, PartialCustomEmojiChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import ChatService from '@rebel/server/services/ChatService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import LogService from '@rebel/server/services/LogService'
import ChannelStore, { YoutubeChannelWithLatestInfo, CreateOrUpdateYoutubeChannelArgs, TwitchChannelWithLatestInfo } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { nameof, promised } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { CalledWithMock, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import EmojiService from '@rebel/server/services/EmojiService'
import EventDispatchService from '@rebel/server/services/EventDispatchService'

// jest is having trouble mocking the correct overload method, so we have to force it into the correct type
type CreateOrUpdateYoutube = CalledWithMock<Promise<YoutubeChannelWithLatestInfo>, ['youtube', string, CreateOrUpdateYoutubeChannelArgs]>

const textPart: PartialTextChatMessage = {
  type: 'text',
  text: 'text',
  isBold: false,
  isItalics: false
}
const emojiPart: PartialEmojiChatMessage = {
  type: 'emoji',
  name: 'emoji name',
  emojiId: 'emojiId',
  image: { url: 'url' },
  label: 'emoji label'
}
const customEmojiPart: PartialCustomEmojiChatMessage = {
  type: 'customEmoji',
  customEmojiId: 1,
  text: textPart,
  emoji: null
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
  userId: data.user1.id,
  youtubeId: data.youtubeChannel1,
  infoHistory: [{ ...data.youtubeChannelInfo1, id: 1, channelId: 1 }]
}
const twitchChannel1: TwitchChannelWithLatestInfo = {
  id: 20,
  userId: data.user3.id,
  twitchId: data.twitchChannel3,
  infoHistory: [{ ...data.twitchChannelInfo3, id: 2, channelId: 2 }]
}

let mockChatStore: MockProxy<ChatStore>
let mockLogService: MockProxy<LogService>
let mockExperienceService: MockProxy<ExperienceService>
let mockViewershipStore: MockProxy<ViewershipStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockEmojiService: MockProxy<EmojiService>
let mockEventDispatchService: MockProxy<EventDispatchService>
let chatService: ChatService

beforeEach(() => {
  mockChatStore = mock<ChatStore>()
  mockLogService = mock<LogService>()
  mockExperienceService = mock<ExperienceService>()
  mockViewershipStore = mock<ViewershipStore>()
  mockChannelStore = mock<ChannelStore>()
  mockEmojiService = mock<EmojiService>()
  mockEventDispatchService = mock<EventDispatchService>()

  chatService = new ChatService(new Dependencies({
    chatStore: mockChatStore,
    logService: mockLogService,
    experienceService: mockExperienceService,
    viewershipStore: mockViewershipStore,
    channelStore: mockChannelStore,
    emojiService: mockEmojiService,
    eventDispatchService: mockEventDispatchService
  }))
})

describe(nameof(ChatService, 'initialise'), () => {
  test('subscribes to chatItem events', () => {
    chatService.initialise()

    const args = single(mockEventDispatchService.onData.mock.calls)
    expect(args[0]).toBe('chatItem')
    expect(args[1]).not.toBeNull()
  })
})

describe(nameof(ChatService, 'onNewChatItem'), () => {
  test('youtube: synthesises correct data and calls required services, then returns true', async () => {
    const chatItemWithCustomEmoji = {
      ...chatItem1,
      messageParts: [textPart, customEmojiPart, emojiPart]
    }; // required semicolon for some reason lol

    (mockChannelStore.createOrUpdate as any as CreateOrUpdateYoutube).calledWith('youtube', data.youtubeChannel1, expect.objectContaining(data.youtubeChannelInfo1)).mockResolvedValue(youtubeChannel1)
    mockEmojiService.applyCustomEmojis.calledWith(textPart, youtubeChannel1.userId).mockResolvedValue([textPart, customEmojiPart])
    mockEmojiService.applyCustomEmojis.calledWith(emojiPart, youtubeChannel1.userId).mockResolvedValue([emojiPart])

    const addedChat = await chatService.onNewChatItem(chatItem1)

    expect(addedChat).toBe(true)

    const [passedChatItem, passedUserId, passedChannelId] = single(mockChatStore.addChat.mock.calls)
    expect(passedChatItem).toEqual(chatItemWithCustomEmoji)
    expect(passedUserId).toBe(youtubeChannel1.userId)
    expect(passedChannelId).toBe(youtubeChannel1.youtubeId)

    const [passedUserId_, passedTimestamp] = single(mockViewershipStore.addViewershipForChatParticipation.mock.calls)
    expect(passedUserId_).toBe(youtubeChannel1.userId)
    expect(passedTimestamp).toBe(chatItem1.timestamp)

    const [passedChatItem_] = single(mockExperienceService.addExperienceForChat.mock.calls)
    expect(passedChatItem_).toBe(chatItem1)
  })

  test('twitch: synthesises correct data and calls required services, then returns true', async () => {
    const chatItemWithCustomEmoji = {
      ...chatItem2,
      messageParts: [textPart, customEmojiPart, emojiPart]
    }
    mockChannelStore.createOrUpdate.calledWith('twitch', data.twitchChannel3, expect.objectContaining(data.twitchChannelInfo3)).mockResolvedValue(twitchChannel1)
    mockEmojiService.applyCustomEmojis.calledWith(textPart, twitchChannel1.userId).mockResolvedValue([textPart, customEmojiPart])
    mockEmojiService.applyCustomEmojis.calledWith(emojiPart, twitchChannel1.userId).mockResolvedValue([emojiPart])

    const addedChat = await chatService.onNewChatItem(chatItem2)

    expect(addedChat).toBe(true)

    const [passedChatItem, passedUserId, passedChannelId] = single(mockChatStore.addChat.mock.calls)
    expect(passedChatItem).toEqual(chatItemWithCustomEmoji)
    expect(passedUserId).toBe(twitchChannel1.userId)
    expect(passedChannelId).toBe(twitchChannel1.twitchId)

    const [passedUserId_, passedTimestamp] = single(mockViewershipStore.addViewershipForChatParticipation.mock.calls)
    expect(passedUserId_).toBe(twitchChannel1.userId)
    expect(passedTimestamp).toBe(chatItem2.timestamp)

    const [passedChatItem_] = single(mockExperienceService.addExperienceForChat.mock.calls)
    expect(passedChatItem_).toBe(chatItem2)
  })

  test('returns false if unable to add chat item, and does not attempt to call services', async () => {
    (mockChannelStore.createOrUpdate as any as CreateOrUpdateYoutube).calledWith('youtube', data.youtubeChannel1, expect.objectContaining(data.youtubeChannelInfo1)).mockResolvedValue(youtubeChannel1)
    mockEmojiService.applyCustomEmojis.mockImplementation((part, _) => promised([part]))
    mockChatStore.addChat.mockRejectedValue(new Error('Test'))

    const addedChat = await chatService.onNewChatItem(chatItem1)

    expect(addedChat).toBe(false)

    expect(mockViewershipStore.addViewershipForChatParticipation.mock.calls.length).toBe(0)
    expect(mockExperienceService.addExperienceForChat.mock.calls.length).toBe(0)
  })
})
