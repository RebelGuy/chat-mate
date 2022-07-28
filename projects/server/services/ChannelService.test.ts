import { Dependencies } from '@rebel/server/context/context'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import ChannelService from '@rebel/server/services/ChannelService'
import ChannelStore, { YoutubeChannelWithLatestInfo, TwitchChannelWithLatestInfo, UserNames } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import { nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockChannelStore: MockProxy<ChannelStore>
let mockChatStore: MockProxy<ChatStore>
let channelService: ChannelService

beforeEach(() => {
  mockChannelStore = mock<ChannelStore>()
  mockChatStore = mock<ChatStore>()

  channelService = new ChannelService(new Dependencies({
    channelStore: mockChannelStore,
    chatStore: mockChatStore
  }))
})

describe(nameof(ChannelService, 'getActiveUserChannels'), () => {
  const channel1: YoutubeChannelWithLatestInfo = {} as any
  const chatItem1: Partial<ChatItemWithRelations> = {
    userId: 1,
    youtubeChannelId: 10, youtubeChannel: channel1,
    twitchChannelId: null, twitchChannel: null,
  }
  const channel2: TwitchChannelWithLatestInfo = {} as any
  const chatItem2: Partial<ChatItemWithRelations> = {
    userId: 2,
    youtubeChannelId: null, youtubeChannel: null,
    twitchChannelId: 5, twitchChannel: channel2
  }

  test('returns all active user channels', async () => {
    mockChatStore.getLastChatOfUsers.calledWith('all').mockResolvedValue([chatItem1 as ChatItemWithRelations, chatItem2 as ChatItemWithRelations])

    const result = await channelService.getActiveUserChannels('all')

    expect(result.length).toBe(2)
    expect(result[0].platform).toBe('youtube')
    expect(result[0].channel).toBe(channel1)
    expect(result[1].platform).toBe('twitch')
    expect(result[1].channel).toBe(channel2)
  })

  test('returns specified active user channels', async () => {
    mockChatStore.getLastChatOfUsers.calledWith(expect.arrayContaining([1])).mockResolvedValue([chatItem1 as ChatItemWithRelations])

    const result = await channelService.getActiveUserChannels([1])

    expect(result.length).toBe(1)
    expect(result[0].platform).toBe('youtube')
    expect(result[0].channel).toBe(channel1)
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
      { userId: 4, youtubeNames: ['Test'], twitchNames: ['Rebel_Guy420', 'Reb', 'Rebel_Guy10000'] }
    ]
    mockChannelStore.getCurrentUserNames.mockResolvedValue(names)

    const result = await channelService.getUserByChannelName('rebel')

    expect(result.length).toBe(3)
    expect(result[0]).toEqual<UserNames>({ userId: 2, youtubeNames: ['Rebel_Guy'], twitchNames: [] })
    expect(result[1]).toEqual<UserNames>({ userId: 3, youtubeNames: ['Rebel_Guy2'], twitchNames: [] })
    expect(result[2]).toEqual<UserNames>({ userId: 4, youtubeNames: [], twitchNames: ['Rebel_Guy420', 'Rebel_Guy10000'] })
  })
})
