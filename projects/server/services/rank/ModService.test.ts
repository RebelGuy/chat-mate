import { Dependencies } from '@rebel/shared/context/context'
import ModService, { IgnoreOptions } from '@rebel/server/services/rank/ModService'
import { InternalRankResult, TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import TwurpleService from '@rebel/server/services/TwurpleService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs } from '@rebel/server/stores/RankStore'
import { single } from '@rebel/shared/util/arrays'
import { UserRankAlreadyExistsError, UserRankNotFoundError } from '@rebel/shared/util/error'
import { expectArray, expectObject, nameof } from '@rebel/shared/testUtils'
import { mock, MockProxy } from 'jest-mock-extended'
import { UserOwnedChannels } from '@rebel/server/stores/ChannelStore'
import UserService from '@rebel/server/services/UserService'
import YoutubeService from '@rebel/server/services/YoutubeService'

let mockChannelStore: MockProxy<ChannelStore>
let mockRankStore: MockProxy<RankStore>
let mockTwurpleService: MockProxy<TwurpleService>
let mockUserService: MockProxy<UserService>
let mockYoutubeService: MockProxy<YoutubeService>
let modService: ModService

beforeEach(() => {
  mockChannelStore = mock()
  mockRankStore = mock()
  mockTwurpleService = mock()
  mockUserService = mock()
  mockYoutubeService = mock()

  modService = new ModService(new Dependencies({
    channelStore: mockChannelStore,
    logService: mock(),
    rankStore: mockRankStore,
    twurpleService: mockTwurpleService,
    userService: mockUserService,
    youtubeService: mockYoutubeService
  }))
})

describe(nameof(ModService, 'setModRank'), () => {
  const primaryUserId = 5
  const streamerId1 = 2
  const loggedInRegisteredUserId = 10
  const testMessage = 'testMessage'

  test('Adds the moderator rank on platforms and the database and returns the new rank', async () => {
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{
      userId: primaryUserId,
      aggregateUserId: primaryUserId,
      youtubeChannelIds: [3, 4],
      twitchChannelIds: [1, 2, 3]
    }])
    const ignoreOptions: IgnoreOptions = { twitchChannelId: 3 }
    const newRank: any = {}
    mockRankStore.addUserRank.calledWith(expectObject<AddUserRankArgs>({ primaryUserId: primaryUserId, streamerId: streamerId1, assignee: loggedInRegisteredUserId, rank: 'mod', expirationTime: null, message: testMessage })).mockResolvedValue(newRank)

    const result = await modService.setModRank(primaryUserId, streamerId1, loggedInRegisteredUserId, true, testMessage, ignoreOptions)

    expect(result.rankResult.rank).toBe(newRank)
    expect(result.youtubeResults).toEqual<YoutubeRankResult[]>([
      { youtubeChannelId: 3, error: null },
      { youtubeChannelId: 4, error: null }
    ])
    expect(result.twitchResults).toEqual<TwitchRankResult[]>([
      { twitchChannelId: 1, error: null },
      { twitchChannelId: 2, error: null }
      // should not have modded twitch channel 3
    ])

    const youtubeCalls = mockYoutubeService.modYoutubeChannel.mock.calls
    expect(youtubeCalls).toEqual(expectArray(youtubeCalls, [
      [streamerId1, 3],
      [streamerId1, 4]
    ]))

    const twitchCalls = mockTwurpleService.modChannel.mock.calls
    expect(twitchCalls).toEqual([[streamerId1, 1], [streamerId1, 2]])
  })

  test('Adding the mod rank when the user is already modded is gracefully handled', async () => {
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{ userId: primaryUserId, aggregateUserId: primaryUserId, youtubeChannelIds: [], twitchChannelIds: [] }])
    mockRankStore.addUserRank.calledWith(expectObject<AddUserRankArgs>({ rank: 'mod', streamerId: streamerId1, assignee: loggedInRegisteredUserId })).mockRejectedValue(new UserRankAlreadyExistsError())

    const result = await modService.setModRank(primaryUserId, streamerId1, loggedInRegisteredUserId, true, null, null)

    expect(result.rankResult).toEqual(expectObject<InternalRankResult>({ rank: null, error: expect.anything() }))
  })

  test('Removes the moderator rank on platforms and the database and returns the updated rank', async () => {
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{
      userId: primaryUserId,
      aggregateUserId: null,
      youtubeChannelIds: [3, 4, 5],
      twitchChannelIds: [1, 2]
    }])
    const ignoreOptions: IgnoreOptions = { youtubeChannelId: 5 }
    const updatedRank: any = {}
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ primaryUserId: primaryUserId, streamerId: streamerId1, removedBy: loggedInRegisteredUserId, rank: 'mod', message: testMessage })).mockResolvedValue(updatedRank)

    const result = await modService.setModRank(primaryUserId, streamerId1, loggedInRegisteredUserId, false, testMessage, ignoreOptions)

    expect(result.rankResult.rank).toBe(updatedRank)
    expect(result.youtubeResults).toEqual<YoutubeRankResult[]>([
      { youtubeChannelId: 3, error: null },
      { youtubeChannelId: 4, error: null }
      // should not have unmodded youtube channel 5
    ])
    expect(result.twitchResults).toEqual<TwitchRankResult[]>([
      { twitchChannelId: 1, error: null },
      { twitchChannelId: 2, error: null }
    ])

    const masterchatCalls = mockYoutubeService.unmodYoutubeChannel.mock.calls
    expect(masterchatCalls).toEqual(expectArray(masterchatCalls, [
      [streamerId1, 3],
      [streamerId1, 4]
    ]))

    const twitchCalls = mockTwurpleService.unmodChannel.mock.calls
    expect(twitchCalls).toEqual([[streamerId1, 1], [streamerId1, 2]])
  })

  test('Removing the mod rank when the user is not modded is gracefully handled', async () => {
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{ userId: primaryUserId, aggregateUserId: null, youtubeChannelIds: [], twitchChannelIds: [] }])
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ rank: 'mod', streamerId: streamerId1, removedBy: loggedInRegisteredUserId })).mockRejectedValue(new UserRankNotFoundError())

    const result = await modService.setModRank(primaryUserId, streamerId1, loggedInRegisteredUserId, false, null, null)

    expect(result.rankResult).toEqual(expectObject<InternalRankResult>({ rank: null, error: expect.anything() }))
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => modService.setModRank(primaryUserId, streamerId1, 1, true, '', null)).rejects.toThrow()
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

  test('Calls Twurple/Youtube methods to add the mod rank', async () => {
    mockChannelStore.getDefaultUserOwnedChannels.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([userChannels])

    const result = await modService.setModRankExternal(defaultUserId, streamerId, true)

    expect(single(result.twitchResults).error).toBeNull()
    expect(single(result.youtubeResults).error).toBeNull()
    expect(single(mockTwurpleService.modChannel.mock.calls)).toEqual([streamerId, twitchChannel])
    expect(single(mockYoutubeService.modYoutubeChannel.mock.calls)).toEqual([streamerId, youtubeChannel])
    expect(mockRankStore.addUserRank.mock.calls.length).toBe(0)
  })

  test('Calls Twurple/Masterchat methods to remove the mod rank', async () => {
    mockChannelStore.getDefaultUserOwnedChannels.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([userChannels])

    const result = await modService.setModRankExternal(defaultUserId, streamerId, false)

    expect(single(result.twitchResults).error).toBeNull()
    expect(single(result.youtubeResults).error).toBeNull()
    expect(single(mockTwurpleService.unmodChannel.mock.calls)).toEqual([streamerId, twitchChannel])
    expect(single(mockYoutubeService.unmodYoutubeChannel.mock.calls)).toEqual([streamerId, youtubeChannel])
    expect(mockRankStore.removeUserRank.mock.calls.length).toBe(0)
  })
})
