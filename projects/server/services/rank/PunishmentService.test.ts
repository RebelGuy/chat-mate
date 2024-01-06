import { Rank } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import PunishmentService, { IgnoreOptions } from '@rebel/server/services/rank/PunishmentService'
import ChannelStore, { UserOwnedChannels } from '@rebel/server/stores/ChannelStore'
import { cast, nameof, expectObject } from '@rebel/shared/testUtils'
import { single } from '@rebel/shared/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { addTime } from '@rebel/shared/util/datetime'
import TwurpleService from '@rebel/server/services/TwurpleService'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs, UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { UserRankAlreadyExistsError, UserRankNotFoundError } from '@rebel/shared/util/error'
import { InternalRankResult, TwitchRankResult, YoutubeRankResult } from '@rebel/server/services/rank/RankService'
import UserService from '@rebel/server/services/UserService'
import YoutubeService from '@rebel/server/services/YoutubeService'

const primaryUserId = 2
const streamerId1 = 3
const streamerName1 = 'name1'
const loggedInRegisteredUserId = 10

const banRank: Rank = { id: 1, name: 'ban', group: 'punishment', displayNameNoun: '', displayNameAdjective: '', description: null }
const timeoutRank: Rank = { id: 2, name: 'timeout', group: 'punishment', displayNameNoun: '', displayNameAdjective: '', description: null }
const muteRank: Rank = { id: 3, name: 'mute', group: 'punishment', displayNameNoun: '', displayNameAdjective: '', description: null }

const activeTimeout: UserRankWithRelations = {
  id: 2,
  primaryUserId: primaryUserId,
  streamerId: streamerId1,
  streamerName: streamerName1,
  expirationTime: addTime(new Date(), 'hours', 1),
  rank: timeoutRank,
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null,
  assignedByUserId: null,
  revokedByUserId: null
}
const revokedBan: UserRankWithRelations = {
  id: 3,
  primaryUserId: primaryUserId,
  streamerId: streamerId1,
  streamerName: streamerName1,
  expirationTime: null,
  rank: banRank,
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: addTime(data.time1, 'seconds', 1),
  assignedByUserId: null,
  revokedByUserId: null
}
const activeBan: UserRankWithRelations = {
  id: 4,
  primaryUserId: primaryUserId,
  streamerId: streamerId1,
  streamerName: streamerName1,
  expirationTime: null,
  rank: banRank,
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null,
  assignedByUserId: null,
  revokedByUserId: null
}
const expiredMute: UserRankWithRelations = {
  id: 5,
  primaryUserId: primaryUserId,
  streamerId: streamerId1,
  streamerName: streamerName1,
  expirationTime: addTime(data.time1, 'seconds', 1),
  rank: muteRank,
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null,
  assignedByUserId: null,
  revokedByUserId: null
}
const activeMute: UserRankWithRelations = {
  id: 6,
  primaryUserId: primaryUserId,
  streamerId: streamerId1,
  streamerName: streamerName1,
  expirationTime: addTime(new Date(), 'hours', 1),
  rank: muteRank,
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null,
  assignedByUserId: null,
  revokedByUserId: null
}
const activeModRank: UserRankWithRelations = {
  id: 7,
  primaryUserId: primaryUserId,
  streamerId: streamerId1,
  streamerName: streamerName1,
  expirationTime: null,
  rank: { name: 'mod', group: 'administration' } as Rank,
  issuedAt: data.time1,
  message: null,
  revokeMessage: null,
  revokedTime: null,
  assignedByUserId: null,
  revokedByUserId: null
}

let mockRankStore: MockProxy<RankStore>
let mockChannelStore: MockProxy<ChannelStore>
let mockTwurpleService: MockProxy<TwurpleService>
let mockUserService: MockProxy<UserService>
let mockYoutubeService: MockProxy<YoutubeService>
let punishmentService: PunishmentService

beforeEach(() => {
  mockRankStore = mock()
  mockChannelStore = mock()
  mockTwurpleService = mock()
  mockUserService = mock()
  mockYoutubeService = mock()

  punishmentService = new PunishmentService(new Dependencies({
    logService: mock(),
    rankStore: mockRankStore,
    channelStore: mockChannelStore,
    twurpleService: mockTwurpleService,
    userService: mockUserService,
    youtubeService: mockYoutubeService
  }))
})

describe(nameof(PunishmentService, 'banUser'), () => {
  test('bans user on platforms and adds database entry', async () => {
    const error2 = 'error2'
    mockYoutubeService.banYoutubeChannel.calledWith(streamerId1, 4).mockRejectedValue(new Error(error2))
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{
      userId: primaryUserId,
      aggregateUserId: null,
      youtubeChannelIds: [3, 4],
      twitchChannelIds: [1, 2, 3]
    }])
    const ignoreOptions: IgnoreOptions = { twitchChannelId: 3 }
    const newPunishment: any = {}
    mockRankStore.addUserRank.calledWith(expectObject<AddUserRankArgs>({ primaryUserId: primaryUserId, rank: 'ban', assignee: loggedInRegisteredUserId })).mockResolvedValue(newPunishment)

    const result = await punishmentService.banUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test', ignoreOptions)

    expect(result.rankResult.rank).toBe(newPunishment)
    expect(result.youtubeResults).toEqual<YoutubeRankResult[]>([
      { youtubeChannelId: 3, error: null },
      { youtubeChannelId: 4, error: error2 }
    ])
    expect(result.twitchResults).toEqual<TwitchRankResult[]>([
      { twitchChannelId: 1, error: null },
      { twitchChannelId: 2, error: null }
      // should not have banned twitch channel 3
    ])

    const youtubeCalls = mockYoutubeService.banYoutubeChannel.mock.calls
    expect(youtubeCalls).toEqual<typeof youtubeCalls>([[streamerId1, 3], [streamerId1, 4]])

    const twitchCalls = mockTwurpleService.banChannel.mock.calls
    expect(twitchCalls).toEqual<typeof twitchCalls>([[streamerId1, 1, 'test'], [streamerId1, 2, 'test']])
  })

  test('Catches error and returns error message', async () => {
    const error = 'Test error'
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([1])).mockResolvedValue([{ userId: 1, aggregateUserId: null, twitchChannelIds: [], youtubeChannelIds: []}])
    mockRankStore.addUserRank.calledWith(expect.anything()).mockRejectedValue(new Error(error))

    const result = await punishmentService.banUser(1, streamerId1, loggedInRegisteredUserId, null, null)

    expect(result.rankResult).toEqual(expectObject<InternalRankResult>({ rank: null, error: error }))
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => punishmentService.banUser(primaryUserId, streamerId1, 1, '', null)).rejects.toThrow()
  })
})

describe(nameof(PunishmentService, 'banUserExternal'), () => {
  test('Calls Twurple/Masterchat methods to add the ban', async () => {
    const defaultUserId = 125
    const streamerId = 81
    const twitchChannel = 5
    const youtubeChannel = 2
    const userChannels: UserOwnedChannels = {
      userId: defaultUserId,
      aggregateUserId: null,
      twitchChannelIds: [twitchChannel],
      youtubeChannelIds: [youtubeChannel]
    }
    const banMessage = 'test123'

    mockChannelStore.getDefaultUserOwnedChannels.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([userChannels])

    const result = await punishmentService.banUserExternal(defaultUserId, streamerId, banMessage)

    expect(single(result.twitchResults).error).toBeNull()
    expect(single(result.youtubeResults).error).toBeNull()
    expect(single(mockTwurpleService.banChannel.mock.calls)).toEqual([streamerId, twitchChannel, banMessage])
    expect(single(mockYoutubeService.banYoutubeChannel.mock.calls)).toEqual([streamerId, youtubeChannel])
    expect(mockRankStore.addUserRank.mock.calls.length).toBe(0)
  })
})

describe(nameof(PunishmentService, 'isUserPunished'), () => {
  test('returns false if there are no active punishments for the user', async () => {
    mockRankStore.getUserRanks.calledWith(expect.arrayContaining([primaryUserId]), streamerId1)
      .mockResolvedValue([{ primaryUserId: primaryUserId, ranks: [activeModRank] }])

    const result = await punishmentService.isUserPunished(primaryUserId, streamerId1)

    expect(result).toBe(false)
  })

  test('returns true if there are active punishments for the user', async () => {
    mockRankStore.getUserRanks.calledWith(expect.arrayContaining([primaryUserId]), streamerId1)
      .mockResolvedValue([{ primaryUserId: primaryUserId, ranks: [activeModRank, activeMute] }])

    const result = await punishmentService.isUserPunished(primaryUserId, streamerId1)

    expect(result).toBe(true)
  })
})

describe(nameof(PunishmentService, 'muteUser'), () => {
  test('adds mute punishment to database', async () => {
    const newPunishment: any = {}
    mockRankStore.addUserRank
      .calledWith(expectObject<AddUserRankArgs>({ primaryUserId: primaryUserId, rank: 'mute', assignee: loggedInRegisteredUserId, expirationTime: expect.any(Date) }))
      .mockResolvedValue(newPunishment)

    const result = await punishmentService.muteUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test', 10)

    expect(result).toBe(newPunishment)
  })

  test('mute is permanent if duration is null', async () => {
    const newPunishment: any = {}
    mockRankStore.addUserRank
      .calledWith(expectObject<AddUserRankArgs>({ primaryUserId: primaryUserId, rank: 'mute', assignee: loggedInRegisteredUserId, expirationTime: null }))
      .mockResolvedValue(newPunishment)

    const result = await punishmentService.muteUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test', null)

    expect(result).toBe(newPunishment)
  })

  test('Rethrows store error', async () => {
    const error = new UserRankAlreadyExistsError()
    mockRankStore.addUserRank.calledWith(expect.anything()).mockRejectedValue(error)

    await expect(() => punishmentService.muteUser(1, streamerId1,loggedInRegisteredUserId,  null, null)).rejects.toThrowError(error)
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => punishmentService.muteUser(primaryUserId, streamerId1, 1, '', 1)).rejects.toThrow()
  })
})

describe(nameof(PunishmentService, 'timeoutUser'), () => {
  test('times out user on platforms and adds database entry', async () => {
    const error1 = 'error1'
    const error3 = 'error3'
    mockYoutubeService.timeoutYoutubeChannel.calledWith(streamerId1, 3, 1000).mockRejectedValue(new Error(error1))
    mockTwurpleService.timeout.calledWith(streamerId1, 1, 'test', 1000).mockRejectedValue(new Error(error3))
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{
      userId: primaryUserId,
      aggregateUserId: null,
      youtubeChannelIds: [3, 4],
      twitchChannelIds: [1, 2, 3]
    }])
    const ignoreOptions: IgnoreOptions = { twitchChannelId: 3 }

    const newPunishment: Partial<UserRankWithRelations> = {
      id: 5,
      streamerId: streamerId1,
      primaryUserId: primaryUserId,
      expirationTime: addTime(new Date(), 'seconds', 1000)
    }
    mockRankStore.addUserRank.calledWith(expectObject<AddUserRankArgs>({ streamerId: streamerId1, primaryUserId: primaryUserId, assignee: loggedInRegisteredUserId, rank: 'timeout' })).mockResolvedValue(newPunishment as UserRankWithRelations)

    const result = await punishmentService.timeoutUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test', 1000, ignoreOptions)

    expect(result.rankResult.rank).toBe(newPunishment)
    expect(result.youtubeResults).toEqual<YoutubeRankResult[]>([
      { youtubeChannelId: 3, error: error1 },
      { youtubeChannelId: 4, error: null },
    ])
    expect(result.twitchResults).toEqual<TwitchRankResult[]>([
      { twitchChannelId: 1, error: error3 },
      { twitchChannelId: 2, error: null }
      // should not have timed out twitch user 3
    ])

    const youtubeCalls = mockYoutubeService.timeoutYoutubeChannel.mock.calls
    expect(youtubeCalls).toEqual<typeof youtubeCalls>([[streamerId1, 3, 1000], [streamerId1, 4, 1000]])

    const timeoutCalls = mockTwurpleService.timeout.mock.calls
    expect(timeoutCalls).toEqual<typeof timeoutCalls>([[streamerId1, 1, 'test', 1000], [streamerId1, 2, 'test', 1000]])
  })

  test('Catches error and returns error message', async () => {
    const error = 'Test error'
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([1])).mockResolvedValue([{ userId: 1, aggregateUserId: null, twitchChannelIds: [], youtubeChannelIds: []}])
    mockRankStore.addUserRank.calledWith(expect.anything()).mockRejectedValue(new Error(error))

    const result = await punishmentService.timeoutUser(1, streamerId1, loggedInRegisteredUserId, null, 1, null)

    expect(result.rankResult).toEqual(expectObject<InternalRankResult>({ rank: null, error: error }))
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => punishmentService.timeoutUser(primaryUserId, streamerId1, 1, '', 1, null)).rejects.toThrow()
  })
})

describe(nameof(PunishmentService, 'timeoutUserExternal'), () => {
  test('Calls Twurple/Masterchat methods to add the timeout', async () => {
    const defaultUserId = 125
    const streamerId = 81
    const twitchChannel = 5
    const youtubeChannel = 2
    const userChannels: UserOwnedChannels = {
      userId: defaultUserId,
      aggregateUserId: null,
      twitchChannelIds: [twitchChannel],
      youtubeChannelIds: [youtubeChannel]
    }
    const rankId = 12
    const timeoutMessage = 'test123'
    const durationSeconds = 1000

    mockChannelStore.getDefaultUserOwnedChannels.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([userChannels])

    const result = await punishmentService.timeoutUserExternal(defaultUserId, streamerId, rankId, timeoutMessage, durationSeconds)

    expect(single(result.twitchResults).error).toBeNull()
    expect(single(result.youtubeResults).error).toBeNull()
    expect(single(mockTwurpleService.timeout.mock.calls)).toEqual([streamerId, twitchChannel, timeoutMessage, durationSeconds])
    expect(single(mockYoutubeService.timeoutYoutubeChannel.mock.calls)).toEqual([streamerId, youtubeChannel, durationSeconds])
    expect(mockRankStore.addUserRank.mock.calls.length).toBe(0)
  })
})

describe(nameof(PunishmentService, 'getCurrentPunishments'), () => {
  test('gets punishments that are active', async () => {
    mockRankStore.getUserRanksForGroup.calledWith('punishment', streamerId1).mockResolvedValue([ activeTimeout, activeBan])

    const result = await punishmentService.getCurrentPunishments(streamerId1)

    expect(result).toEqual([activeTimeout, activeBan])
  })
})

describe(nameof(PunishmentService, 'getPunishmentHistory'), () => {
  test('gets history from store and returns', async () => {
    const history = [activeBan, activeModRank, revokedBan, expiredMute]
    mockRankStore.getUserRankHistory.calledWith(primaryUserId, streamerId1).mockResolvedValue(history)

    const result = await punishmentService.getPunishmentHistory(primaryUserId, streamerId1)

    expect(result).toEqual([activeBan, revokedBan, expiredMute])
  })
})

describe(nameof(PunishmentService, 'unbanUser'), () => {
  test('unbans user on platforms and revokes ban in database', async () => {
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{
      userId: primaryUserId,
      aggregateUserId: null,
      youtubeChannelIds: [2, 3, 4],
      twitchChannelIds: [1, 2]
    }])
    const ignoreOptions: IgnoreOptions = { youtubeChannelId: 2 }
    const revokedPunishment: any = {}
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ primaryUserId: primaryUserId, removedBy: loggedInRegisteredUserId, rank: 'ban' })).mockResolvedValue(revokedPunishment)

    const result = await punishmentService.unbanUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test', ignoreOptions)

    expect(result.rankResult.rank).toBe(revokedPunishment)
    expect(result.youtubeResults).toEqual<YoutubeRankResult[]>([
      // should not have unbanned youtube user 2
      { youtubeChannelId: 3, error: null },
      { youtubeChannelId: 4, error: null }
    ])
    expect(result.twitchResults).toEqual<TwitchRankResult[]>([
      { twitchChannelId: 1, error: null },
      { twitchChannelId: 2, error: null }
    ])

    const youtubeCalls = mockYoutubeService.unbanYoutubeChannel.mock.calls
    expect(youtubeCalls).toEqual<typeof youtubeCalls>([[streamerId1, 3], [streamerId1, 4]])

    const twitchCalls = mockTwurpleService.unbanChannel.mock.calls
    expect(twitchCalls).toEqual<typeof twitchCalls>([[streamerId1, 1], [streamerId1, 2]])
  })

  test('Catches error and returns error message', async () => {
    const error = 'Test error'
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{ userId: primaryUserId, aggregateUserId: null, youtubeChannelIds: [], twitchChannelIds: [] }])
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ primaryUserId: primaryUserId, removedBy: loggedInRegisteredUserId, rank: 'ban' })).mockRejectedValue(new UserRankNotFoundError(error))

    const result = await punishmentService.unbanUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test', null)

    expect(result.rankResult).toEqual(expectObject<InternalRankResult>({ rank: null, error: error }))
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => punishmentService.unbanUser(primaryUserId, streamerId1, 1, '', null)).rejects.toThrow()
  })
})


describe(nameof(PunishmentService, 'unmuteUser'), () => {
  test('adds mute to database', async () => {
    const expectedResult: any = {}
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ primaryUserId: primaryUserId, removedBy: loggedInRegisteredUserId, rank: 'mute' })).mockResolvedValue(expectedResult)

    const result = await punishmentService.unmuteUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test')

    expect(result).toBe(expectedResult)
  })

  test('Rethrows store error', async () => {
    const error = new UserRankNotFoundError()
    mockRankStore.removeUserRank.calledWith(expect.anything()).mockRejectedValue(error)

    await expect(() => punishmentService.unmuteUser(1, streamerId1, loggedInRegisteredUserId, null)).rejects.toThrowError(error)
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => punishmentService.unmuteUser(primaryUserId, streamerId1, 1, '')).rejects.toThrow()
  })
})

describe(nameof(PunishmentService, 'untimeoutUser'), () => {
  test('untimeouts user on twitch and revokes timeout in database', async () => {
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{
      userId: primaryUserId,
      aggregateUserId: null,
      youtubeChannelIds: [2, 3, 4],
      twitchChannelIds: [1, 2, 3]
    }])
    const ignoreOptions: IgnoreOptions = { twitchChannelId: 3, youtubeChannelId: 2 }
    const expectedResult = cast<UserRankWithRelations>({ id: 5 })
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ primaryUserId: primaryUserId, removedBy: loggedInRegisteredUserId, rank: 'timeout' })).mockResolvedValue(expectedResult)

    const result = await punishmentService.untimeoutUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test', ignoreOptions)

    expect(result.rankResult.rank).toBe(expectedResult)
    expect(result.youtubeResults).toEqual<YoutubeRankResult[]>([
      // should not have un-timed out youtube channel 2
      { youtubeChannelId: 3, error: null },
      { youtubeChannelId: 4, error: null }
    ])
    expect(result.twitchResults).toEqual<TwitchRankResult[]>([
      { twitchChannelId: 1, error: null },
      { twitchChannelId: 2, error: null }
      // should not have un-timed out twitch channel 3
    ])

    const youtubeCalls = mockYoutubeService.untimeoutYoutubeChannel.mock.calls
    expect(youtubeCalls).toEqual<typeof youtubeCalls>([[streamerId1, 3], [streamerId1, 4]])

    const twitchCalls = mockTwurpleService.untimeout.mock.calls
    expect(twitchCalls).toEqual<typeof twitchCalls>([[streamerId1, 1], [streamerId1, 2]])
  })

  test('Catches error and returns error message', async () => {
    const error = 'Test error'
    mockChannelStore.getConnectedUserOwnedChannels.calledWith(expect.arrayContaining([primaryUserId])).mockResolvedValue([{ userId: primaryUserId, aggregateUserId: null, youtubeChannelIds: [], twitchChannelIds: [] }])
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ primaryUserId: primaryUserId, removedBy: loggedInRegisteredUserId, rank: 'timeout' })).mockRejectedValue(new UserRankNotFoundError(error))

    const result = await punishmentService.untimeoutUser(primaryUserId, streamerId1, loggedInRegisteredUserId, 'test', null)

    expect(result.rankResult).toEqual(expectObject<InternalRankResult>({ rank: null, error: error }))
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(primaryUserId).mockResolvedValue(true)

    await expect(() => punishmentService.untimeoutUser(primaryUserId, streamerId1, 1, '', null)).rejects.toThrow()
  })
})

describe(nameof(PunishmentService, 'untimeoutUserExternal'), () => {
  test('Calls Twurple method to remove the timeout', async () => {
    const defaultUserId = 125
    const streamerId = 81
    const twitchChannel = 5
    const youtubeChannel = 2
    const userChannels: UserOwnedChannels = {
      userId: defaultUserId,
      aggregateUserId: null,
      twitchChannelIds: [twitchChannel],
      youtubeChannelIds: [youtubeChannel]
    }
    const rankId = 581

    mockChannelStore.getDefaultUserOwnedChannels.calledWith(expect.arrayContaining([defaultUserId])).mockResolvedValue([userChannels])

    const result = await punishmentService.untimeoutUserExternal(defaultUserId, streamerId, rankId, 'test123')

    expect(single(result.twitchResults).error).toBeNull()
    expect(single(result.youtubeResults).error).toBeNull()
    expect(single(mockYoutubeService.untimeoutYoutubeChannel.mock.calls)).toEqual([streamerId, youtubeChannel])
    expect(single(mockTwurpleService.untimeout.mock.calls)).toEqual([streamerId, twitchChannel])
    expect(mockRankStore.removeUserRank.mock.calls.length).toBe(0)
  })
})
