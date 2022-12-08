import { Dependencies } from '@rebel/server/context/context'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import MasterchatProxyService from '@rebel/server/services/MasterchatProxyService'
import ModService from '@rebel/server/services/rank/ModService'
import { InternalRankResult, TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs } from '@rebel/server/stores/RankStore'
import { single } from '@rebel/server/util/arrays'
import { UserRankAlreadyExistsError, UserRankNotFoundError } from '@rebel/server/util/error'
import { cast, expectObject, nameof } from '@rebel/server/_test/utils'
import { mock, MockProxy } from 'jest-mock-extended'

let mockChannelStore: MockProxy<ChannelStore>
let mockChatStore: MockProxy<ChatStore>
let mockMasterchatProxyService: MockProxy<MasterchatProxyService>
let mockRankStore: MockProxy<RankStore>
let mockTwurpleService: MockProxy<TwurpleService>
let modService: ModService

beforeEach(() => {
  mockChannelStore = mock()
  mockChatStore = mock()
  mockMasterchatProxyService = mock()
  mockRankStore = mock()
  mockTwurpleService = mock()

  modService = new ModService(new Dependencies({
    channelStore: mockChannelStore,
    chatStore: mockChatStore,
    logService: mock(),
    masterchatProxyService: mockMasterchatProxyService,
    rankStore: mockRankStore,
    twurpleService: mockTwurpleService
  }))
})

describe(nameof(ModService, 'setModRank'), () => {
  const userId1 = 5
  const streamerId1 = 2
  const loggedInRegisteredUserId = 10
  const testMessage = 'testMessage'
  const contextToken1 = 'testToken1'
  const contextToken2 = 'testToken2'
  const error2 = 'error2'

  test('Adds the moderator rank on platforms and the database and returns the new rank', async () => {
    mockMasterchatProxyService.mod.calledWith(contextToken1).mockResolvedValue(true)
    mockMasterchatProxyService.mod.calledWith(contextToken2).mockRejectedValue(new Error(error2))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 1).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: contextToken1 }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 2).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: contextToken2 }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 3).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: null }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 4).mockResolvedValue(null)
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(userId1).mockResolvedValue({
      userId: userId1,
      youtubeChannels: [1, 2, 3, 4],
      twitchChannels: [1, 2]
    })
    const newRank: any = {}
    mockRankStore.addUserRank.calledWith(expectObject<AddUserRankArgs>({ chatUserId: userId1, streamerId: streamerId1, assignee: loggedInRegisteredUserId, rank: 'mod', expirationTime: null, message: testMessage })).mockResolvedValue(newRank)

    const result = await modService.setModRank(userId1, streamerId1, loggedInRegisteredUserId, true, testMessage)

    expect(result.rankResult.rank).toBe(newRank)
    expect(result.youtubeResults).toEqual<YoutubeRankResult[]>([
      { youtubeChannelId: 1, error: null },
      { youtubeChannelId: 2, error: expect.stringContaining(error2) },
      { youtubeChannelId: 3, error: expect.anything() },
      { youtubeChannelId: 4, error: expect.anything() }
    ])
    expect(result.twitchResults).toEqual<TwitchRankResult[]>([
      { twitchChannelId: 1, error: null },
      { twitchChannelId: 2, error: null }
    ])

    const suppliedContextTokens = mockMasterchatProxyService.mod.mock.calls.map(c => single(c))
    expect(suppliedContextTokens).toEqual([contextToken1, contextToken2])

    const twitchCalls = mockTwurpleService.modChannel.mock.calls
    expect(twitchCalls).toEqual([[streamerId1, 1], [streamerId1, 2]])
  })

  test('Adding the mod rank when the user is already modded is gracefully handled', async () => {
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(userId1).mockResolvedValue({ userId: userId1, youtubeChannels: [], twitchChannels: [] })
    mockRankStore.addUserRank.calledWith(expectObject<AddUserRankArgs>({ rank: 'mod', streamerId: streamerId1, assignee: loggedInRegisteredUserId })).mockRejectedValue(new UserRankAlreadyExistsError())

    const result = await modService.setModRank(userId1, streamerId1, loggedInRegisteredUserId, true, null)

    expect(result.rankResult).toEqual(expectObject<InternalRankResult>({ rank: null, error: expect.anything() }))
  })

  test('Removes the moderator rank on platforms and the database and returns the updated rank', async () => {
    mockMasterchatProxyService.unmod.calledWith(contextToken1).mockResolvedValue(true)
    mockMasterchatProxyService.unmod.calledWith(contextToken2).mockRejectedValue(new Error(error2))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 1).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: contextToken1 }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 2).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: contextToken2 }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 3).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: null }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 4).mockResolvedValue(null)
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(userId1).mockResolvedValue({
      userId: userId1,
      youtubeChannels: [1, 2, 3, 4],
      twitchChannels: [1, 2]
    })
    const updatedRank: any = {}
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ chatUserId: userId1, streamerId: streamerId1, removedBy: loggedInRegisteredUserId, rank: 'mod', message: testMessage })).mockResolvedValue(updatedRank)

    const result = await modService.setModRank(userId1, streamerId1, loggedInRegisteredUserId, false, testMessage)

    expect(result.rankResult.rank).toBe(updatedRank)
    expect(result.youtubeResults).toEqual<YoutubeRankResult[]>([
      { youtubeChannelId: 1, error: null },
      { youtubeChannelId: 2, error: expect.stringContaining(error2) },
      { youtubeChannelId: 3, error: expect.anything() },
      { youtubeChannelId: 4, error: expect.anything() }
    ])
    expect(result.twitchResults).toEqual<TwitchRankResult[]>([
      { twitchChannelId: 1, error: null },
      { twitchChannelId: 2, error: null }
    ])

    const suppliedContextTokens = mockMasterchatProxyService.unmod.mock.calls.map(c => single(c))
    expect(suppliedContextTokens).toEqual([contextToken1, contextToken2])

    const twitchCalls = mockTwurpleService.unmodChannel.mock.calls
    expect(twitchCalls).toEqual([[streamerId1, 1], [streamerId1, 2]])
  })

  test('Removing the mod rank when the user is not modded is gracefully handled', async () => {
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(userId1).mockResolvedValue({ userId: userId1, youtubeChannels: [], twitchChannels: [] })
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ rank: 'mod', streamerId: streamerId1, removedBy: loggedInRegisteredUserId })).mockRejectedValue(new UserRankNotFoundError())

    const result = await modService.setModRank(userId1, streamerId1, loggedInRegisteredUserId, false, null)

    expect(result.rankResult).toEqual(expectObject<InternalRankResult>({ rank: null, error: expect.anything() }))
  })
})
