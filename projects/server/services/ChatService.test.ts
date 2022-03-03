import { Dependencies } from '@rebel/server/context/context'
import { ChatItem, PartialCustomEmojiChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import ChatService from '@rebel/server/services/ChatService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import LogService from '@rebel/server/services/LogService'
import ChannelStore, { ChannelWithLatestInfo } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import ViewershipStore from '@rebel/server/stores/ViewershipStore'
import { nameof, promised, single } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import EmojiService from '@rebel/server/services/EmojiService'

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
  text: textPart
}
const chatItem: ChatItem = {
  id: 'id1',
  author: data.author1,
  messageParts: [textPart, emojiPart],
  timestamp: data.time1.getTime()
}

const channel: ChannelWithLatestInfo = {
  id: 1,
  youtubeId: data.channel1,
  infoHistory: [{ ...data.channelInfo1, id: 1, channelId: 1 }]
}

let mockChatStore: MockProxy<ChatStore>
let mockLogService: MockProxy<LogService>
let mockExperienceService: MockProxy<ExperienceService>
let mockViewershipStore: MockProxy<ViewershipStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockEmojiService: MockProxy<EmojiService>
let chatService: ChatService

beforeEach(() => {
  mockChatStore = mock<ChatStore>()
  mockLogService = mock<LogService>()
  mockExperienceService = mock<ExperienceService>()
  mockViewershipStore = mock<ViewershipStore>()
  mockChannelStore = mock<ChannelStore>()
  mockEmojiService = mock<EmojiService>()

  chatService = new ChatService(new Dependencies({
    chatStore: mockChatStore,
    logService: mockLogService,
    experienceService: mockExperienceService,
    viewershipStore: mockViewershipStore,
    channelStore: mockChannelStore,
    emojiService: mockEmojiService
  }))
})

describe(nameof(ChatService, 'onNewChatItem'), () => {
  test('synthesises correct data and calls required services, then returns true', async () => {
    const chatItemWithCustomEmoji = {
      ...chatItem,
      messageParts: [textPart, customEmojiPart, emojiPart]
    }
    mockChannelStore.createOrUpdate.calledWith(data.channel1, expect.objectContaining(data.channelInfo1)).mockResolvedValue(channel)
    mockEmojiService.applyCustomEmojis.calledWith(textPart, channel.id).mockResolvedValue([textPart, customEmojiPart])
    mockEmojiService.applyCustomEmojis.calledWith(emojiPart, channel.id).mockResolvedValue([emojiPart])

    const addedChat = await chatService.onNewChatItem(chatItem)

    expect(addedChat).toBe(true)

    const [passedChatItem, channelId] = single(mockChatStore.addChat.mock.calls)
    expect(passedChatItem).toEqual(chatItemWithCustomEmoji)
    expect(channelId).toBe(channel.id)

    const [passedChannel, passedTimestamp] = single(mockViewershipStore.addViewershipForChatParticipation.mock.calls)
    expect(passedChannel).toBe(channel.id)
    expect(passedTimestamp).toBe(chatItem.timestamp)

    const [passedChatItem_] = single(mockExperienceService.addExperienceForChat.mock.calls)
    expect(passedChatItem_).toBe(chatItem)
  })

  test('returns false if unable to add chat item, and does not attempt to call services', async () => {
    mockChannelStore.createOrUpdate.calledWith(data.channel1, expect.objectContaining(data.channelInfo1)).mockResolvedValue(channel)
    mockEmojiService.applyCustomEmojis.mockImplementation((part, _) => promised([part]))
    mockChatStore.addChat.mockRejectedValue(new Error('Test'))

    const addedChat = await chatService.onNewChatItem(chatItem)

    expect(addedChat).toBe(false)

    expect(mockViewershipStore.addViewershipForChatParticipation.mock.calls.length).toBe(0)
    expect(mockExperienceService.addExperienceForChat.mock.calls.length).toBe(0)
  })
})
