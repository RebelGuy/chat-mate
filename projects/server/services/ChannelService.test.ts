import { Dependencies } from '@rebel/server/context/context'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import ChannelService from '@rebel/server/services/ChannelService'
import ChannelStore, { YoutubeChannelWithLatestInfo, TwitchChannelWithLatestInfo, UserNames, UserChannel, UserOwnedChannels } from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import { cast, expectObject, nameof } from '@rebel/server/_test/utils'
import { single, sortBy } from '@rebel/server/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'

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
  const chatItem1 = cast<ChatItemWithRelations>({
    userId: 1,
    youtubeChannelId: 10, youtubeChannel: channel1,
    twitchChannelId: null, twitchChannel: null,
    time: data.time1,
    user: {}
  })
  const channel2: TwitchChannelWithLatestInfo = {} as any
  const chatItem2 = cast<ChatItemWithRelations>({
    userId: 2,
    youtubeChannelId: null, youtubeChannel: null,
    twitchChannelId: 5, twitchChannel: channel2,
    time: data.time2,
    user: {}
  })

  test('returns all active user channels', async () => {
    mockChatStore.getLastChatOfUsers.calledWith(streamerId, 'all').mockResolvedValue([chatItem1 as ChatItemWithRelations, chatItem2 as ChatItemWithRelations])

    const result = await channelService.getActiveUserChannels(streamerId, 'all')

    expect(result.length).toBe(2)
    expect(result.find(r => r.defaultUserId === 1)).toEqual(expect.objectContaining<UserChannel>({
      defaultUserId: 1,
      platformInfo: {
        platform: 'youtube',
        channel: channel1
      }
    }))
    expect(result.find(r => r.defaultUserId === 2)).toEqual(expect.objectContaining<UserChannel>({
      defaultUserId: 2,
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
      defaultUserId: 1,
      platformInfo: {
        platform: 'youtube',
        channel: channel1
      }
    }))
  })

  test('Returns only the channel with the most recent activity if the user has several linked channels', async () => {
    const channel3 = { id: 12345 }
    mockChatStore.getLastChatOfUsers.calledWith(streamerId, expect.arrayContaining([1, 7])).mockResolvedValue(cast<ChatItemWithRelations[]>([
      { userId: 5, user: { aggregateChatUserId: 1 }, twitchChannel: channel2, time: data.time2 },
      { userId: 6, user: { aggregateChatUserId: 1 }, youtubeChannel: channel1, time: data.time1 },
      { userId: 7, user: { aggregateChatUserId: 2 }, youtubeChannel: channel3, time: data.time3 },
      { userId: 8, user: { aggregateChatUserId: 2 }, youtubeChannel: channel3, time: data.time4 } // same aggregate user but we are not interested in this particular channel
    ]))

    const result = await channelService.getActiveUserChannels(streamerId, [1, 7])

    expect(result.length).toBe(2)
    expect(result).toEqual(expectObject(result, [
      { defaultUserId: 7, platformInfo: { platform: 'youtube', channel: channel3 } },
      { defaultUserId: 1, platformInfo: { platform: 'twitch', channel: channel2 } } // should have re-routed to the aggregate user
    ]))
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
      twitchChannelIds: [10, 25]
    })
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(userId).mockResolvedValue(connectedChannelIds)
    mockChannelStore.getYoutubeChannelFromChannelId.calledWith(10).mockResolvedValue(youtubeChannel1)
    mockChannelStore.getYoutubeChannelFromChannelId.calledWith(20).mockResolvedValue(youtubeChannel2)
    mockChannelStore.getTwitchChannelFromChannelId.calledWith(10).mockResolvedValue(twitchChannel1)
    mockChannelStore.getTwitchChannelFromChannelId.calledWith(25).mockResolvedValue(twitchChannel2)

    const result = await channelService.getConnectedUserChannels(userId)

    expect(sortBy(result, c => c.defaultUserId)).toEqual(expectObject(result, [
      { defaultUserId: youtubeChannel1.userId, platformInfo: { platform: 'youtube', channel: youtubeChannel1 } },
      { defaultUserId: youtubeChannel2.userId, platformInfo: { platform: 'youtube', channel: youtubeChannel2 } },
      { defaultUserId: twitchChannel1.userId, platformInfo: { platform: 'twitch', channel: twitchChannel1 } },
      { defaultUserId: twitchChannel2.userId, platformInfo: { platform: 'twitch', channel: twitchChannel2 } },
    ]))
  })
})

describe(nameof(ChannelService, 'searchChannelsByName'), () => {
  test('returns null if there is no match', async () => {
    mockChannelStore.getAllChannels.calledWith().mockResolvedValue([{ defaultUserId: 1, youtubeNames: ['Mr Cool Guy'], twitchNames: [] }])

    const result = await channelService.searchChannelsByName('rebel_guy')

    expect(result).toEqual([])
  })

  test('returns best match', async () => {
    const names: UserNames[] = [
      { userId: 1, youtubeNames: ['Mr Cool Guy'], twitchNames: [] },
      { userId: 2, youtubeNames: ['Rebel_Guy'], twitchNames: [] },
      { userId: 3, youtubeNames: ['Rebel_Guy2'], twitchNames: [] },
      { userId: 4, youtubeNames: ['Test'], twitchNames: ['Rebel_Guy420', 'Reb', 'Rebel_Guy10000'] }
    ]
    mockChannelStore.getAllChannels.calledWith().mockResolvedValue(names)

    const result = await channelService.searchChannelsByName('rebel')

    expect(result.length).toBe(3)
    expect(result[0]).toEqual<UserNames>({ userId: 2, youtubeNames: ['Rebel_Guy'], twitchNames: [] })
    expect(result[1]).toEqual<UserNames>({ userId: 3, youtubeNames: ['Rebel_Guy2'], twitchNames: [] })
    expect(result[2]).toEqual<UserNames>({ userId: 4, youtubeNames: [], twitchNames: ['Rebel_Guy420', 'Rebel_Guy10000'] })
  })
})
