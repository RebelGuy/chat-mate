import { Dependencies } from '@rebel/server/context/context'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import ChannelService from '@rebel/server/services/ChannelService'
import ChannelStore, { YoutubeChannelWithLatestInfo, TwitchChannelWithLatestInfo, UserNames, UserChannel, UserOwnedChannels } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import { cast, expectObject, nameof } from '@rebel/server/_test/utils'
import { single, sortBy } from '@rebel/server/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'

const streamerId = 5

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
    mockChatStore.getLastChatOfUsers.calledWith(streamerId, 'all').mockResolvedValue([chatItem1 as ChatItemWithRelations, chatItem2 as ChatItemWithRelations])

    const result = await channelService.getActiveUserChannels(streamerId, 'all')

    expect(result.length).toBe(2)
    expect(result[0]).toEqual(expect.objectContaining<UserChannel>({
      userId: 1,
      platformInfo: {
        platform: 'youtube',
        channel: channel1
      }
    }))
    expect(result[1]).toEqual(expect.objectContaining<UserChannel>({
      userId: 2,
      platformInfo: {
        platform: 'twitch',
        channel: channel2
      }
    }))
  })

  test('returns specified active user channels', async () => {
    mockChatStore.getLastChatOfUsers.calledWith(streamerId, expect.arrayContaining([1])).mockResolvedValue([chatItem1 as ChatItemWithRelations])

    const result = await channelService.getActiveUserChannels(streamerId, [1])

    expect(single(result)).toEqual(expect.objectContaining<UserChannel>({
      userId: 1,
      platformInfo: {
        platform: 'youtube',
        channel: channel1
      }
    }))
  })
})

describe(nameof(ChannelService, 'getConnectedUserChannels'), () => {
  test('Gets channel info of connected channels', async () => {
    const userId = 9515
    const youtubeChannel1 = cast<YoutubeChannelWithLatestInfo>({ userId: 3, youtubeId: 'x', infoHistory: [{ name: 'name1' }] })
    const youtubeChannel2 = cast<YoutubeChannelWithLatestInfo>({ userId: 5, youtubeId: 'y', infoHistory: [{ name: 'name2' }] })
    const twitchChannel1 = cast<TwitchChannelWithLatestInfo>({ userId: 67, twitchId: '12', infoHistory: [{ userName: 'name1' }] })
    const twitchChannel2 = cast<TwitchChannelWithLatestInfo>({ userId: 69, twitchId: '34', infoHistory: [{ userName: 'name2' }] })
    const connectedChannelIds = cast<UserOwnedChannels>({
      youtubeChannels: [10, 20],
      twitchChannels: [10, 25]
    })
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(userId).mockResolvedValue(connectedChannelIds)
    mockChannelStore.getYoutubeChannelFromChannelId.calledWith(10).mockResolvedValue(youtubeChannel1)
    mockChannelStore.getYoutubeChannelFromChannelId.calledWith(20).mockResolvedValue(youtubeChannel2)
    mockChannelStore.getTwitchChannelFromChannelId.calledWith(10).mockResolvedValue(twitchChannel1)
    mockChannelStore.getTwitchChannelFromChannelId.calledWith(25).mockResolvedValue(twitchChannel2)

    const result = await channelService.getConnectedUserChannels(userId)

    expect(sortBy(result, c => c.userId)).toEqual(expectObject(result, [
      { userId: youtubeChannel1.userId, platformInfo: { platform: 'youtube', channel: youtubeChannel1 } },
      { userId: youtubeChannel2.userId, platformInfo: { platform: 'youtube', channel: youtubeChannel2 } },
      { userId: twitchChannel1.userId, platformInfo: { platform: 'twitch', channel: twitchChannel1 } },
      { userId: twitchChannel2.userId, platformInfo: { platform: 'twitch', channel: twitchChannel2 } },
    ]))
  })
})

describe(nameof(ChannelService, 'getUserById'), () => {
  test('returns null if user with id does not exist', async () => {
    mockChannelStore.getCurrentUserNames.calledWith().mockResolvedValue([{ userId: 1, youtubeNames: ['Mr Cool Guy'], twitchNames: [] }])

    const result = await channelService.getUserById(2)

    expect(result).toBeNull()
  })

  test('returns correct channel with id', async () => {
    const names: UserNames[] = [
      { userId: 1, youtubeNames: ['Mr Cool Guy'], twitchNames: [] },
      { userId: 2, youtubeNames: ['Rebel'], twitchNames: [] },
      { userId: 3, youtubeNames: ['Rebel_Guy'], twitchNames: [] }
    ]
    mockChannelStore.getCurrentUserNames.calledWith().mockResolvedValue(names)

    const result = await channelService.getUserById(2)

    expect(result).toEqual(names[1])
  })
})

describe(nameof(ChannelService, 'getUserByChannelName'), () => {
  test('returns null if there is no match', async () => {
    mockChannelStore.getCurrentUserNames.calledWith().mockResolvedValue([{ userId: 1, youtubeNames: ['Mr Cool Guy'], twitchNames: [] }])

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
    mockChannelStore.getCurrentUserNames.calledWith().mockResolvedValue(names)

    const result = await channelService.getUserByChannelName('rebel')

    expect(result.length).toBe(3)
    expect(result[0]).toEqual<UserNames>({ userId: 2, youtubeNames: ['Rebel_Guy'], twitchNames: [] })
    expect(result[1]).toEqual<UserNames>({ userId: 3, youtubeNames: ['Rebel_Guy2'], twitchNames: [] })
    expect(result[2]).toEqual<UserNames>({ userId: 4, youtubeNames: [], twitchNames: ['Rebel_Guy420', 'Rebel_Guy10000'] })
  })
})
