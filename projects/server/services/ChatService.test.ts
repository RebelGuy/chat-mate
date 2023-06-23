import { Dependencies } from '@rebel/shared/context/context'
import { ChatItem, PartialCustomEmojiChatMessage, PartialEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import ChatService from '@rebel/server/services/ChatService'
import ExperienceService from '@rebel/server/services/ExperienceService'
import LogService from '@rebel/server/services/LogService'
import ChannelStore, { YoutubeChannelWithLatestInfo, CreateOrUpdateYoutubeChannelArgs, TwitchChannelWithLatestInfo } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import { cast, expectArray, expectObject, nameof, promised } from '@rebel/shared/testUtils'
import { single } from '@rebel/shared/util/arrays'
import { CalledWithMock, mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import EmojiService from '@rebel/server/services/EmojiService'
import EventDispatchService from '@rebel/server/services/EventDispatchService'
import LivestreamStore from '@rebel/server/stores/LivestreamStore'
import { ChatMessage, Livestream } from '@prisma/client'
import CommandService, { NormalisedCommand } from '@rebel/server/services/command/CommandService'
import CommandStore from '@rebel/server/stores/CommandStore'
import CommandHelpers from '@rebel/server/helpers/CommandHelpers'

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
  image: { url: 'url' },
  label: 'emoji label'
}
const customEmojiPart: PartialCustomEmojiChatMessage = {
  type: 'customEmoji',
  customEmojiId: 1,
  customEmojiVersion: 1,
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
  userId: 1,
  youtubeId: data.youtubeChannel1,
  infoHistory: [{ ...data.youtubeChannelInfo1, id: 1, channelId: 1 }]
}
const twitchChannel1: TwitchChannelWithLatestInfo = {
  id: 20,
  userId: 3,
  twitchId: data.twitchChannel3,
  infoHistory: [{ ...data.twitchChannelInfo3, id: 2, channelId: 2 }]
}

let mockChatStore: MockProxy<ChatStore>
let mockLogService: MockProxy<LogService>
let mockExperienceService: MockProxy<ExperienceService>
let mockChannelStore: MockProxy<ChannelStore>
let mockEmojiService: MockProxy<EmojiService>
let mockEventDispatchService: MockProxy<EventDispatchService>
let mockLivestreamStore: MockProxy<LivestreamStore>
let mockCommandService: MockProxy<CommandService>
let mockCommandHelpers: MockProxy<CommandHelpers>
let mockCommandStore: MockProxy<CommandStore>
let chatService: ChatService

beforeEach(() => {
  mockChatStore = mock<ChatStore>()
  mockLogService = mock<LogService>()
  mockExperienceService = mock<ExperienceService>()
  mockChannelStore = mock<ChannelStore>()
  mockEmojiService = mock<EmojiService>()
  mockEventDispatchService = mock<EventDispatchService>()
  mockLivestreamStore = mock<LivestreamStore>()
  mockCommandService = mock<CommandService>()
  mockCommandHelpers = mock<CommandHelpers>()
  mockCommandStore = mock<CommandStore>()

  chatService = new ChatService(new Dependencies({
    chatStore: mockChatStore,
    logService: mockLogService,
    experienceService: mockExperienceService,
    channelStore: mockChannelStore,
    emojiService: mockEmojiService,
    eventDispatchService: mockEventDispatchService,
    livestreamStore: mockLivestreamStore,
    commandHelpers: mockCommandHelpers,
    commandService: mockCommandService,
    commandStore: mockCommandStore
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
    }
    const streamerId = 2
    const addedChatMessage = cast<ChatMessage>({})
    const livestream = cast<Livestream>({}); // required semicolon for some reason lol

    (mockChannelStore.createOrUpdate as any as CreateOrUpdateYoutube).calledWith('youtube', data.youtubeChannel1, expect.objectContaining(data.youtubeChannelInfo1)).mockResolvedValue(youtubeChannel1)
    mockChatStore.addChat.calledWith(chatItem1, streamerId, youtubeChannel1.userId, youtubeChannel1.youtubeId).mockResolvedValue(addedChatMessage)
    mockEmojiService.applyCustomEmojis.calledWith(textPart, youtubeChannel1.userId, streamerId).mockResolvedValue([textPart, customEmojiPart])
    mockEmojiService.applyCustomEmojis.calledWith(emojiPart, youtubeChannel1.userId, streamerId).mockResolvedValue([emojiPart])
    mockCommandHelpers.extractNormalisedCommand.calledWith(expect.arrayContaining([textPart, customEmojiPart, emojiPart])).mockReturnValue(null)
    mockLivestreamStore.getActiveLivestream.calledWith(streamerId).mockResolvedValue(livestream)

    const addedChat = await chatService.onNewChatItem(chatItem1, streamerId)

    expect(addedChat).toBe(true)

    const [passedChatItem_, passedStreamerId_] = single(mockExperienceService.addExperienceForChat.mock.calls)
    expect(passedChatItem_).toBe(chatItem1)
    expect(passedStreamerId_).toBe(streamerId)
  })

  test('twitch: synthesises correct data and calls required services, then returns true', async () => {
    const chatItemWithCustomEmoji = {
      ...chatItem2,
      messageParts: [textPart, customEmojiPart, emojiPart]
    }
    const streamerId = 2
    const addedChatMessage = cast<ChatMessage>({})
    const livestream = cast<Livestream>({})

    mockChannelStore.createOrUpdate.calledWith('twitch', data.twitchChannel3, expect.objectContaining(data.twitchChannelInfo3)).mockResolvedValue(twitchChannel1)
    mockChatStore.addChat.calledWith(chatItem2, streamerId, twitchChannel1.userId, twitchChannel1.twitchId).mockResolvedValue(addedChatMessage)
    mockEmojiService.applyCustomEmojis.calledWith(textPart, twitchChannel1.userId, streamerId).mockResolvedValue([textPart, customEmojiPart])
    mockEmojiService.applyCustomEmojis.calledWith(emojiPart, twitchChannel1.userId, streamerId).mockResolvedValue([emojiPart])
    mockCommandHelpers.extractNormalisedCommand.calledWith(expect.arrayContaining([textPart, customEmojiPart, emojiPart])).mockReturnValue(null)
    mockLivestreamStore.getActiveLivestream.calledWith(streamerId).mockResolvedValue(livestream)

    const addedChat = await chatService.onNewChatItem(chatItem2, streamerId)

    expect(addedChat).toBe(true)

    const [passedChatItem_, passedStreamerId_] = single(mockExperienceService.addExperienceForChat.mock.calls)
    expect(passedChatItem_).toBe(chatItem2)
    expect(passedStreamerId_).toBe(streamerId)
  })

  test('Executes command and does not perform normal chat side effects', async () => {
    const streamerId = 2
    const addedChatMessage = cast<ChatMessage>({ id: 56 })
    const command: NormalisedCommand = { normalisedName: 'TEST' }
    const commandId = 5

    mockChannelStore.createOrUpdate.calledWith('twitch', data.twitchChannel3, expect.objectContaining(data.twitchChannelInfo3)).mockResolvedValue(twitchChannel1)
    mockEmojiService.applyCustomEmojis.mockImplementation(part => Promise.resolve([part]))
    mockChatStore.addChat.calledWith(chatItem2, streamerId, twitchChannel1.userId, twitchChannel1.twitchId).mockResolvedValue(addedChatMessage)
    mockCommandHelpers.extractNormalisedCommand.calledWith(expect.arrayContaining(chatItem2.messageParts)).mockReturnValue(command)
    mockCommandStore.addCommand.calledWith(addedChatMessage.id, command).mockResolvedValue(commandId)

    const addedChat = await chatService.onNewChatItem(chatItem2, streamerId)

    expect(addedChat).toBe(true)

    expect(single(mockCommandService.queueCommandExecution.mock.calls)).toEqual([commandId])
    expect(mockExperienceService.addExperienceForChat.mock.calls.length).toBe(0)
  })

  test('returns false if chat item already exists, and does not attempt to call services', async () => {
    const streamerId = 2;
    (mockChannelStore.createOrUpdate as any as CreateOrUpdateYoutube).calledWith('youtube', data.youtubeChannel1, expect.objectContaining(data.youtubeChannelInfo1)).mockResolvedValue(youtubeChannel1)
    mockEmojiService.applyCustomEmojis.mockImplementation((part, _) => promised([part]))
    mockChatStore.addChat.calledWith(chatItem1, streamerId, youtubeChannel1.userId, youtubeChannel1.youtubeId).mockResolvedValue(null)

    const addedChat = await chatService.onNewChatItem(chatItem1, streamerId)

    expect(addedChat).toBe(false)

    expect(mockExperienceService.addExperienceForChat.mock.calls.length).toBe(0)
  })
})
