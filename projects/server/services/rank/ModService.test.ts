import { Dependencies } from '@rebel/shared/context/context'
import { ChatItemWithRelations } from '@rebel/server/models/chat'
import MasterchatService from '@rebel/server/services/MasterchatService'
import ModService from '@rebel/server/services/rank/ModService'
import { InternalRankResult, TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import ChatStore from '@rebel/server/stores/ChatStore'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs } from '@rebel/server/stores/RankStore'
import { single } from '@rebel/shared/util/arrays'
import { UserRankAlreadyExistsError, UserRankNotFoundError } from '@rebel/shared/util/error'
import { cast, expectArray, expectObject, nameof } from '@rebel/shared/testUtils'
import { mock, MockProxy } from 'jest-mock-extended'
import { UserOwnedChannels } from '@rebel/server/stores/ChannelStore'
import UserService from '@rebel/server/services/UserService'

let mockChannelStore: MockProxy<ChannelStore>
let mockChatStore: MockProxy<ChatStore>
let mockMasterchatService: MockProxy<MasterchatService>
let mockRankStore: MockProxy<RankStore>
let mockTwurpleService: MockProxy<TwurpleService>
let mockUserService: MockProxy<UserService>
let modService: ModService

beforeEach(() => {
  mockChannelStore = mock()
  mockChatStore = mock()
  mockMasterchatService = mock()
  mockRankStore = mock()
  mockTwurpleService = mock()
  mockUserService = mock()

  modService = new ModService(new Dependencies({
    channelStore: mockChannelStore,
    chatStore: mockChatStore,
    logService: mock(),
    masterchatService: mockMasterchatService,
    rankStore: mockRankStore,
    twurpleService: mockTwurpleService,
    userService: mockUserService
  }))
})

describe(nameof(ModService, 'setModRank'), () => {
  const primaryUserId = 5
  const streamerId1 = 2
  const loggedInRegisteredUserId = 10
  const testMessage = 'testMessage'
  const contextToken1 = 'testToken1'
  const contextToken2 = 'testToken2'
  const error2 = 'error2'

  test('Adds the moderator rank on platforms and the database and returns the new rank', async () => {
    mockMasterchatService.mod.calledWith(streamerId1, contextToken1).mockResolvedValue(true)
    mockMasterchatService.mod.calledWith(streamerId1, contextToken2).mockRejectedValue(new Error(error2))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 1).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: contextToken1 }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 2).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: contextToken2 }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 3).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: null }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 4).mockResolvedValue(null)
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{
      userId: primaryUserId,
      aggregateUserId: primaryUserId,
      youtubeChannelIds: [1, 2, 3, 4],
      twitchChannelIds: [1, 2]
    }])
    const newRank: any = {}
    mockRankStore.addUserRank.calledWith(expectObject<AddUserRankArgs>({ primaryUserId: primaryUserId, streamerId: streamerId1, assignee: loggedInRegisteredUserId, rank: 'mod', expirationTime: null, message: testMessage })).mockResolvedValue(newRank)

    const result = await modService.setModRank(primaryUserId, streamerId1, loggedInRegisteredUserId, true, testMessage)

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

    const masterchatCalls = mockMasterchatService.mod.mock.calls
    expect(masterchatCalls).toEqual(expectArray(masterchatCalls, [
      [streamerId1, contextToken1],
      [streamerId1, contextToken2]
    ]))

    const twitchCalls = mockTwurpleService.modChannel.mock.calls
    expect(twitchCalls).toEqual([[streamerId1, 1], [streamerId1, 2]])
  })

  test('Adding the mod rank when the user is already modded is gracefully handled', async () => {
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{ userId: primaryUserId, aggregateUserId: primaryUserId, youtubeChannelIds: [], twitchChannelIds: [] }])
    mockRankStore.addUserRank.calledWith(expectObject<AddUserRankArgs>({ rank: 'mod', streamerId: streamerId1, assignee: loggedInRegisteredUserId })).mockRejectedValue(new UserRankAlreadyExistsError())

    const result = await modService.setModRank(primaryUserId, streamerId1, loggedInRegisteredUserId, true, null)

    expect(result.rankResult).toEqual(expectObject<InternalRankResult>({ rank: null, error: expect.anything() }))
  })

  test('Removes the moderator rank on platforms and the database and returns the updated rank', async () => {
    mockMasterchatService.unmod.calledWith(streamerId1, contextToken1).mockResolvedValue(true)
    mockMasterchatService.unmod.calledWith(streamerId1, contextToken2).mockRejectedValue(new Error(error2))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 1).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: contextToken1 }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 2).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: contextToken2 }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 3).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken: null }))
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId1, 4).mockResolvedValue(null)
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{
      userId: primaryUserId,
      aggregateUserId: null,
      youtubeChannelIds: [1, 2, 3, 4],
      twitchChannelIds: [1, 2]
    }])
    const updatedRank: any = {}
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ primaryUserId: primaryUserId, streamerId: streamerId1, removedBy: loggedInRegisteredUserId, rank: 'mod', message: testMessage })).mockResolvedValue(updatedRank)

    const result = await modService.setModRank(primaryUserId, streamerId1, loggedInRegisteredUserId, false, testMessage)

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

    const masterchatCalls = mockMasterchatService.unmod.mock.calls
    expect(masterchatCalls).toEqual(expectArray(masterchatCalls, [
      [streamerId1, contextToken1],
      [streamerId1, contextToken2]
    ]))

    const twitchCalls = mockTwurpleService.unmodChannel.mock.calls
    expect(twitchCalls).toEqual([[streamerId1, 1], [streamerId1, 2]])
  })

  test('Removing the mod rank when the user is not modded is gracefully handled', async () => {
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{ userId: primaryUserId, aggregateUserId: null, youtubeChannelIds: [], twitchChannelIds: [] }])
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ rank: 'mod', streamerId: streamerId1, removedBy: loggedInRegisteredUserId })).mockRejectedValue(new UserRankNotFoundError())

    const result = await modService.setModRank(primaryUserId, streamerId1, loggedInRegisteredUserId, false, null)

    expect(result.rankResult).toEqual(expectObject<InternalRankResult>({ rank: null, error: expect.anything() }))
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => modService.setModRank(primaryUserId, streamerId1, 1, true, '')).rejects.toThrow()
  })
})

describe(nameof(ModService, 'setModRankExternal'), () => {
  const defaultUserId = 125
  const streamerId = 81
  const twitchChannel = 5
  const youtubeChannel = 2
  const userChannels: UserOwnedChannels = {
    userId: defaultUserId,
    aggregateUserId: 1236,
    twitchChannelIds: [twitchChannel],
    youtubeChannelIds: [youtubeChannel]
  }
  const contextToken = 'test'

  test('Calls Twurple/Masterchat methods to add the mod rank', async () => {
    mockChannelStore.getDefaultUserOwnedChannels.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([userChannels])
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId, youtubeChannel).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken }))
    mockMasterchatService.mod.calledWith(streamerId, contextToken).mockResolvedValue(true)
    mockTwurpleService.modChannel.calledWith(streamerId, twitchChannel).mockResolvedValue()

    const result = await modService.setModRankExternal(defaultUserId, streamerId, true)

    expect(single(result.twitchResults).error).toBeNull()
    expect(single(result.youtubeResults).error).toBeNull()
    expect(single(mockTwurpleService.modChannel.mock.calls)).toEqual([streamerId, twitchChannel])
    expect(mockMasterchatService.mod.mock.calls.length).toBe(1)
    expect(mockRankStore.addUserRank.mock.calls.length).toBe(0)
  })

  test('Calls Twurple/Masterchat methods to remove the mod rank', async () => {
    mockChannelStore.getDefaultUserOwnedChannels.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([userChannels])
    mockChatStore.getLastChatByYoutubeChannel.calledWith(streamerId, youtubeChannel).mockResolvedValue(cast<ChatItemWithRelations>({ contextToken }))
    mockMasterchatService.unmod.calledWith(streamerId, contextToken).mockResolvedValue(true)
    mockTwurpleService.unmodChannel.calledWith(streamerId, twitchChannel).mockResolvedValue()

    const result = await modService.setModRankExternal(defaultUserId, streamerId, false)

    expect(single(result.twitchResults).error).toBeNull()
    expect(single(result.youtubeResults).error).toBeNull()
    expect(single(mockTwurpleService.unmodChannel.mock.calls)).toEqual([streamerId, twitchChannel])
    expect(mockMasterchatService.unmod.mock.calls.length).toBe(1)
    expect(mockRankStore.removeUserRank.mock.calls.length).toBe(0)
  })
})
