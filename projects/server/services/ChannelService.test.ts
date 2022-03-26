import { Dependencies } from '@rebel/server/context/context'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import ChannelService from '@rebel/server/services/ChannelService'
import ChannelStore, { ChannelWithLatestInfo, TwitchChannelWithLatestInfo, UserNames } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import { nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'

let mockChannelStore: MockProxy<ChannelStore>
let mockChatStore: MockProxy<ChatStore>
let channelService: ChannelService

beforeEach(() => {
  mockChannelStore = mock<ChannelStore>()

  channelService = new ChannelService(new Dependencies({
    channelStore: mockChannelStore,
    chatStore: mockChatStore
  }))
})

describe(nameof(ChannelService, 'getActiveUserChannel'), () => {
  test('returns null if user not found', async () => {
    mockChatStore.getLastChatByUser.mockResolvedValue(null)

    const result = await channelService.getActiveUserChannel(1)

    expect(result).toBeNull()
  })

  test('returns active youtube channel', async () => {
    const channel: ChannelWithLatestInfo = {} as any
    const chatItem: ChatItemWithRelations = {
      userId: 2,
      channelId: 5, channel: channel,
      twitchChannelId: null, twitchChannel: null
    } as any
    mockChatStore.getLastChatByUser.calledWith(2).mockResolvedValue(chatItem)

    const result = await channelService.getActiveUserChannel(2)

    expect(result!.platform).toBe('youtube')
    expect(result!.channel).toBe(channel)
  })
  

  test('returns active twitch channel', async () => {
    const channel: TwitchChannelWithLatestInfo = {} as any
    const chatItem: ChatItemWithRelations = {
      userId: 2,
      channelId: null, channel: null,
      twitchChannelId: 5, twitchChannel: channel
    } as any
    mockChatStore.getLastChatByUser.calledWith(2).mockResolvedValue(chatItem)

    const result = await channelService.getActiveUserChannel(2)

    expect(result!.platform).toBe('twitch')
    expect(result!.channel).toBe(channel)
  })

  test('throws if no channels attached to chat item', async () => {
    mockChatStore.getLastChatByUser.calledWith(2).mockResolvedValue({ userId: 2 } as any)

    await expect(() => channelService.getActiveUserChannel(2)).rejects.toThrow()
  })
})

describe(nameof(ChannelService, 'getUserById'), () => {
  test('returns null if user with id does not exist', async () => {
    mockChannelStore.getCurrentUserNames.mockResolvedValue([{ userId: 1, youtubeNames: ['Mr Cool Guy'], twitchNames: [] }])

    const result = await channelService.getUserById(2)

    expect(result).toBeNull()
  })
  
  test('returns correct channel with id', async () => {
    const names: UserNames[] = [
      { userId: 1, youtubeNames: ['Mr Cool Guy'], twitchNames: [] },
      { userId: 2, youtubeNames: ['Rebel'], twitchNames: [] },
      { userId: 3, youtubeNames: ['Rebel_Guy'], twitchNames: [] }
    ]
    mockChannelStore.getCurrentUserNames.mockResolvedValue(names)

    const result = await channelService.getUserById(2)

    expect(result).toEqual(names[1])
  })
})

describe(nameof(ChannelService, 'getUserByChannelName'), () => {
  test('returns null if there is no match', async () => {
    mockChannelStore.getCurrentUserNames.mockResolvedValue([{ userId: 1, youtubeNames: ['Mr Cool Guy'], twitchNames: [] }])

    const result = await channelService.getUserByChannelName('rebel_guy')

    expect(result).toEqual([])
  })

  test('returns best match', async () => {
    const names: UserNames[] = [
      { userId: 1, youtubeNames: ['Mr Cool Guy'], twitchNames: [] },
      { userId: 2, youtubeNames: ['Rebel_Guy'], twitchNames: [] },
      { userId: 3, youtubeNames: ['Rebel_Guy2'], twitchNames: [] },
      { userId: 4, youtubeNames: ['Test'], twitchNames: ['Rebel_Guy2'] }
    ]
    mockChannelStore.getCurrentUserNames.mockResolvedValue(names)

    const result = await channelService.getUserByChannelName('rebel')

    expect(result).toEqual([names[2], names[1], names[3]])
  })
})
