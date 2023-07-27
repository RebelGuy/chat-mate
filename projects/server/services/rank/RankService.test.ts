import { Rank } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import RankService, { CustomisableRank } from '@rebel/server/services/rank/RankService'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs, UserRanks, UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { single } from '@rebel/shared/util/arrays'
import { InvalidCustomRankError, UserRankAlreadyExistsError, UserRankNotFoundError } from '@rebel/shared/util/error'
import { cast, expectObject, expectObjectDeep, nameof } from '@rebel/shared/testUtils'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { Singular } from '@rebel/shared/types'
import RankHelpers from '@rebel/server/helpers/RankHelpers'
import UserService from '@rebel/server/services/UserService'

const ownerRank = cast<Rank>({ name: 'owner', group: 'administration' })
const famousRank = cast<Rank>({ name: 'famous', group: 'cosmetic' })
const donatorRank = cast<Rank>({ name: 'donator', group: 'donation' })
const adminRank = cast<Rank>({ name: 'admin', group: 'administration' })
const bannedRank = cast<Rank>({ name: 'ban', group: 'punishment' })
const modRank = cast<Rank>({ name: 'mod', group: 'administration' })
const memberRank = cast<Rank>({ name: 'member', group: 'donation' })

const streamer1 = 124
const streamer2 = 125
const user1 = 85

let mockRankStore: MockProxy<RankStore>
let mockRankHelpers: MockProxy<RankHelpers>
let mockUserService: MockProxy<UserService>
let rankService: RankService

beforeEach(() => {
  mockRankStore = mock()
  mockRankHelpers = mock()
  mockUserService = mock()

  rankService = new RankService(new Dependencies({
    rankStore: mockRankStore,
    rankHelpers: mockRankHelpers,
    userService: mockUserService,
    logService: mock(),
  }))
})

describe(nameof(RankService, 'addOrUpdateCustomRankName'), () => {
  test('Validates the custom rank name and makes a request to the RankStore', async () => {
    mockRankHelpers.validateCustomRankName.mockImplementation(x => x)

    await rankService.addOrUpdateCustomRankName(streamer1, user1, 'donator', 'test1', true)

    expect(mockRankHelpers.validateCustomRankName).toBeCalledWith('test1')
    const rankStoreCall = single(mockRankStore.addOrUpdateCustomRankName.mock.calls)
    expect(rankStoreCall).toEqual(expectObjectDeep(rankStoreCall, [streamer1, user1, 'donator', 'test1', true]))
  })

  test('Throws if the user is currently busy', async () => {
    mockUserService.isUserBusy.calledWith(user1).mockResolvedValue(true)

    await expect(() => rankService.addOrUpdateCustomRankName(streamer1, user1, 'donator', 'test1', true)).rejects.toThrow()
  })

  test('Throws if the given rank name is invalid', async () => {
    await expect(() => rankService.addOrUpdateCustomRankName(streamer1, user1, 'abc' as CustomisableRank, 'test1', true)).rejects.toThrowError(InvalidCustomRankError)
  })
})

describe(nameof(RankService, 'getAccessibleRanks'), () => {
  test('Returns Regular ranks', async () => {
    mockRankStore.getRanks.calledWith().mockResolvedValue([ownerRank, famousRank, donatorRank, adminRank, bannedRank])

    const result = await rankService.getAccessibleRanks()

    expect(result).toEqual([famousRank, donatorRank, bannedRank])
  })
})

describe(nameof(RankService, 'getCustomisableRanks'), () => {
  test('Returns the ranks that are customisable', async () => {
    mockRankStore.getRanks.calledWith().mockResolvedValue(cast<Rank[]>([{ name: 'ban' }, { name: 'supporter' }, { name: 'donator' }]))

    const result = await rankService.getCustomisableRanks()

    expect(result).toEqual(expectObject(result, [{ name: 'supporter' }, { name: 'donator' }]))
  })
})

describe(nameof(RankService, 'transferRanks'), () => {
  test('Revokes the ranks of the old user and re-applies them to the new user', async () => {
    const fromUserId = 5
    const toUserId = 19

    const rank1 = cast<UserRankWithRelations>({
      rank: famousRank,
      streamerId: streamer1,
      assignedByUserId: 2,
      expirationTime: null
    })
    const rank2 = cast<UserRankWithRelations>({
      rank: modRank,
      streamerId: streamer1,
      assignedByUserId: 3,
      expirationTime: new Date()
    })
    const rank3 = cast<UserRankWithRelations>({
      rank: memberRank,
      streamerId: streamer2,
      assignedByUserId: 4,
      expirationTime: null
    })
    mockRankStore.getAllUserRanks.calledWith(fromUserId).mockResolvedValue({ primaryUserId: fromUserId, ranks: [rank1, rank2, rank3] })

    const result = await rankService.transferRanks(fromUserId, toUserId, '', true, [])

    // honestly there's not much else that is useful to test, so this will do
    expect(mockRankStore.removeUserRank.mock.calls.length).toBe(3)
    expect(mockRankStore.addUserRank.mock.calls.length).toBe(3)
    expect(result).toBe(0)
  })

  test('Copies the ranks of the old user to the new user', async () => {
    const fromUserId = 5
    const toUserId = 19

    const rank1 = cast<UserRankWithRelations>({
      rank: famousRank,
      streamerId: streamer1,
      assignedByUserId: 2,
      expirationTime: null
    })
    mockRankStore.getAllUserRanks.calledWith(fromUserId).mockResolvedValue({ primaryUserId: fromUserId, ranks: [rank1] })

    const result = await rankService.transferRanks(fromUserId, toUserId, '', false, [])

    // honestly there's not much else that is useful to test, so this will do
    expect(mockRankStore.removeUserRank.mock.calls.length).toBe(0)
    expect(mockRankStore.addUserRank.mock.calls.length).toBe(1)
    expect(result).toBe(0)
  })

  test(`Ignores ${UserRankAlreadyExistsError.name}s and ${UserRankNotFoundError.name}s`, async () => {
    const fromUserId = 5
    const toUserId = 19

    const rank1 = cast<UserRankWithRelations>({
      rank: famousRank,
      streamerId: streamer1,
      assignedByUserId: 2,
      expirationTime: null
    })
    mockRankStore.getAllUserRanks.calledWith(fromUserId).mockResolvedValue({ primaryUserId: fromUserId, ranks: [rank1] })
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ streamerId: streamer1, primaryUserId: fromUserId, rank: 'famous' })).mockRejectedValue(new UserRankNotFoundError())
    mockRankStore.addUserRank.calledWith(expectObject<AddUserRankArgs>({ streamerId: streamer1, primaryUserId: toUserId, rank: 'famous' })).mockRejectedValue(new UserRankAlreadyExistsError())

    const result = await rankService.transferRanks(fromUserId, toUserId, '', true, [])

    expect(result).toBe(2)
  })

  test('Does not process ranks in the `ignoreRanks` parameter', async () => {
    const fromUserId = 5
    const toUserId = 19

    const rank1 = cast<UserRankWithRelations>({
      rank: famousRank,
      streamerId: streamer1,
      assignedByUserId: 2,
      expirationTime: null
    })
    const rank2 = cast<UserRankWithRelations>({
      rank: modRank,
      streamerId: streamer1,
      assignedByUserId: 3,
      expirationTime: new Date()
    })
    mockRankStore.getAllUserRanks.calledWith(fromUserId).mockResolvedValue({ primaryUserId: fromUserId, ranks: [rank1, rank2] })

    const result = await rankService.transferRanks(fromUserId, toUserId, '', true, ['famous'])

    // honestly there's not much else that is useful to test, so this will do
    expect(mockRankStore.removeUserRank.mock.calls.length).toBe(2)
    expect(mockRankStore.addUserRank.mock.calls.length).toBe(1)
    expect(result).toBe(0)
  })
})

describe(nameof(RankService, 'mergeRanks'), () => {
  const defaultUser = 5
  const aggregateUser = 7

  test('Treats ranks for each streamer separately', async () => {
    const ranks1 = cast<UserRanks>({ ranks: []})
    const ranks2 = cast<UserRanks>({ ranks: [{
      id: 1,
      rank: ownerRank,
      streamerId: streamer1
    }, {
      id: 1,
      rank: ownerRank,
      streamerId: streamer2
    }]})
    mockRankStore.getAllUserRanks.calledWith(defaultUser).mockResolvedValue(ranks1)
    mockRankStore.getAllUserRanks.calledWith(aggregateUser).mockResolvedValue(ranks2)

    // act
    const result = await rankService.mergeRanks(defaultUser, aggregateUser, [], '')

    // assert
    expect(result.warnings).toBe(0)
    expect(result.individualResults.length).toBe(2)

    for (const mergeResult of result.individualResults) {
      expect(mergeResult.oldRanks.length).toBe(0)
      expect(mergeResult.additions.length).toBe(0)
      expect(mergeResult.extensions.length).toBe(0)
      expect(mergeResult.unchanged.length).toBe(1)
      expect(mergeResult.removals.length).toBe(0)
    }
  })

  test(`The aggregate user's rank is unchanged if there is no equivalent rank for the default user`, async () => {
    const ranks1 = cast<UserRanks>({ ranks: []})
    const ranks2 = cast<UserRanks>({ ranks: [{
      id: 1,
      rank: ownerRank,
      expirationTime: data.time1
    }]})
    mockRankStore.getAllUserRanks.calledWith(defaultUser).mockResolvedValue(ranks1)
    mockRankStore.getAllUserRanks.calledWith(aggregateUser).mockResolvedValue(ranks2)

    // act
    const result = await rankService.mergeRanks(defaultUser, aggregateUser, [], '')

    // assert
    expect(result.warnings).toBe(0)

    const mergeResult = single(result.individualResults)
    const removalCalls = mockRankStore.removeUserRank.mock.calls.map(args => single(args))
    expect(removalCalls.length).toBe(0)

    const updateCalls = mockRankStore.updateRankExpiration.mock.calls
    expect(updateCalls.length).toBe(0)

    const addCalls = mockRankStore.addUserRank.mock.calls.map(args => single(args))
    expect(addCalls.length).toBe(0)

    expect(mergeResult.oldRanks.length).toBe(0)
    expect(mergeResult.additions.length).toBe(0)
    expect(mergeResult.extensions.length).toBe(0)
    expect(mergeResult.unchanged.length).toBe(1)
    expect(mergeResult.removals.length).toBe(0)
  })

  test(`The default user's rank is transferred to the aggregate user if the aggregate user doesn't have that rank`, async () => {
    const ranks1 = cast<UserRanks>({ ranks: [{
      id: 1,
      rank: ownerRank,
      expirationTime: data.time1
    }]})
    const ranks2 = cast<UserRanks>({ ranks: []})
    mockRankStore.getAllUserRanks.calledWith(defaultUser).mockResolvedValue(ranks1)
    mockRankStore.getAllUserRanks.calledWith(aggregateUser).mockResolvedValue(ranks2)

    // act
    const result = await rankService.mergeRanks(defaultUser, aggregateUser, [], '')

    // assert
    expect(result.warnings).toBe(0)

    const mergeResult = single(result.individualResults)
    const removalCalls = mockRankStore.removeUserRank.mock.calls.map(args => single(args))
    expect(removalCalls.length).toBe(1)
    expect(removalCalls).toEqual([
      expectObject<Singular<typeof removalCalls>>({ primaryUserId: defaultUser, rank: 'owner' }),
    ])

    const updateCalls = mockRankStore.updateRankExpiration.mock.calls
    expect(updateCalls.length).toBe(0)

    const addCalls = mockRankStore.addUserRank.mock.calls.map(args => single(args))
    expect(addCalls.length).toBe(1)
    expect(addCalls).toEqual([
      expectObject<Singular<typeof addCalls>>({ primaryUserId: aggregateUser, rank: 'owner', expirationTime: ranks1.ranks[0].expirationTime }),
    ])

    expect(mergeResult.oldRanks.length).toBe(1)
    expect(mergeResult.additions.length).toBe(1)
    expect(mergeResult.extensions.length).toBe(0)
    expect(mergeResult.unchanged.length).toBe(0)
    expect(mergeResult.removals.length).toBe(0)
  })

  test(`If the default and aggregate user have the same rank, but the aggregate user's rank has the same or a later expiry date, it will not be updated`, async () => {
    const ranks1 = cast<UserRanks>({ ranks: [{
      id: 1,
      rank: ownerRank,
      expirationTime: data.time1
    }, {
      id: 2,
      rank: famousRank,
      expirationTime: data.time3
    }]})
    const ranks2 = cast<UserRanks>({ ranks: [{
      id: 3,
      rank: ownerRank,
      expirationTime: data.time2
    }, {
      id: 4,
      rank: famousRank,
      expirationTime: null // never expires
    }]})
    mockRankStore.getAllUserRanks.calledWith(defaultUser).mockResolvedValue(ranks1)
    mockRankStore.getAllUserRanks.calledWith(aggregateUser).mockResolvedValue(ranks2)

    // act
    const result = await rankService.mergeRanks(defaultUser, aggregateUser, [], '')

    // assert
    expect(result.warnings).toBe(0)

    const mergeResult = single(result.individualResults)
    const removalCalls = mockRankStore.removeUserRank.mock.calls.map(args => single(args))
    expect(removalCalls.length).toBe(2)
    expect(removalCalls).toEqual([
      expectObject<Singular<typeof removalCalls>>({ primaryUserId: defaultUser, rank: 'owner' }),
      expectObject<Singular<typeof removalCalls>>({ primaryUserId: defaultUser, rank: 'famous' })
    ])

    const updateCalls = mockRankStore.updateRankExpiration.mock.calls
    expect(updateCalls.length).toBe(0)

    expect(mockRankStore.addUserRank.mock.calls.length).toBe(0)

    expect(mergeResult.oldRanks.length).toBe(2)
    expect(mergeResult.additions.length).toBe(0)
    expect(mergeResult.extensions.length).toBe(0)
    expect(mergeResult.unchanged.length).toBe(2)
    expect(mergeResult.removals.length).toBe(0)
  })

  test(`If the default and aggregate user have the same rank, but the default user's rank has a later expiry date, the aggregate user's rank will be extended`, async () => {
    const ranks1 = cast<UserRanks>({ ranks: [{
      id: 1,
      rank: ownerRank,
      expirationTime: data.time2
    }, {
      id: 2,
      rank: famousRank,
      expirationTime: null // never expires
    }]})
    const ranks2 = cast<UserRanks>({ ranks: [{
      id: 3,
      rank: ownerRank,
      expirationTime: data.time1
    }, {
      id: 4,
      rank: famousRank,
      expirationTime: data.time3
    }]})
    mockRankStore.getAllUserRanks.calledWith(defaultUser).mockResolvedValue(ranks1)
    mockRankStore.getAllUserRanks.calledWith(aggregateUser).mockResolvedValue(ranks2)

    // act
    const result = await rankService.mergeRanks(defaultUser, aggregateUser, [], '')

    // assert
    expect(result.warnings).toBe(0)

    const mergeResult = single(result.individualResults)
    const removalCalls = mockRankStore.removeUserRank.mock.calls.map(args => single(args))
    expect(removalCalls.length).toBe(2)
    expect(removalCalls).toEqual([
      expectObject<Singular<typeof removalCalls>>({ primaryUserId: defaultUser, rank: 'owner' }),
      expectObject<Singular<typeof removalCalls>>({ primaryUserId: defaultUser, rank: 'famous' })
    ])

    const updateCalls = mockRankStore.updateRankExpiration.mock.calls
    expect(updateCalls.length).toBe(2)
    expect(updateCalls).toEqual([
      [ranks2.ranks[0].id, ranks1.ranks[0].expirationTime],
      [ranks2.ranks[1].id, ranks1.ranks[1].expirationTime]
    ])

    expect(mockRankStore.addUserRank.mock.calls.length).toBe(0)

    expect(mergeResult.oldRanks.length).toBe(2)
    expect(mergeResult.additions.length).toBe(0)
    expect(mergeResult.extensions.length).toBe(2)
    expect(mergeResult.unchanged.length).toBe(0)
    expect(mergeResult.removals.length).toBe(0)
  })

  test("Removes both users' ranks contained in the `removeRanks` parameter", async () => {
    const ranks1 = cast<UserRanks>({ ranks: [{
      id: 1,
      rank: ownerRank
    }, {
      id: 2,
      rank: famousRank
    }]})
    const ranks2 = cast<UserRanks>({ ranks: [{
      id: 3,
      rank: famousRank
    }, {
      id: 4,
      rank: bannedRank
    }]})
    mockRankStore.getAllUserRanks.calledWith(defaultUser).mockResolvedValue(ranks1)
    mockRankStore.getAllUserRanks.calledWith(aggregateUser).mockResolvedValue(ranks2)

    const removedRank1 = cast<UserRankWithRelations>({ id: 1 })
    const removedRank2 = cast<UserRankWithRelations>({ id: 2 })
    const removedRank3 = cast<UserRankWithRelations>({ id: 3 })
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ rank: 'owner', primaryUserId: defaultUser })).mockResolvedValue(removedRank1)
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ rank: 'famous', primaryUserId: defaultUser })).mockResolvedValue(removedRank2)
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ rank: 'famous', primaryUserId: aggregateUser })).mockResolvedValue(removedRank3)

    // act
    const result = await rankService.mergeRanks(defaultUser, aggregateUser, ['owner', 'famous'], '')

    // assert
    expect(result.warnings).toBe(0)

    const mergeResult = single(result.individualResults)
    expect(mergeResult.oldRanks.length).toBe(2)
    expect(mergeResult.oldRanks[0]).toBe(removedRank1)
    expect(mergeResult.oldRanks[1]).toBe(removedRank2)
    expect(mergeResult.additions.length).toBe(0)
    expect(mergeResult.extensions.length).toBe(0)
    expect(single(mergeResult.unchanged)).toBe(ranks2.ranks[1])
    expect(single(mergeResult.removals)).toBe(removedRank3)
    expect(mockRankStore.addUserRank.mock.calls.length).toBe(0)
    expect(mockRankStore.updateRankExpiration.mock.calls.length).toBe(0)
  })

  test(`Ignores ${UserRankAlreadyExistsError.name}s and ${UserRankNotFoundError.name}s`, async () => {
    const ranks1 = cast<UserRanks>({ ranks: [{
      id: 1, // will get removed
      rank: famousRank,
      expirationTime: data.time2
    }, {
      id: 2, // will get removed but re-added to aggregate user
      rank: memberRank
    }]})
    const ranks2 = cast<UserRanks>({ ranks: [{
      id: 3, // will get extended
      rank: famousRank,
      expirationTime: data.time1
    }, {
      id: 4, // will get removed due to function parameter
      rank: bannedRank
    }]})
    mockRankStore.getAllUserRanks.calledWith(defaultUser).mockResolvedValue(ranks1)
    mockRankStore.getAllUserRanks.calledWith(aggregateUser).mockResolvedValue(ranks2)

    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ rank: 'famous', primaryUserId: defaultUser })).mockRejectedValue(new UserRankNotFoundError())
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ rank: 'member', primaryUserId: defaultUser })).mockRejectedValue(new UserRankNotFoundError())
    mockRankStore.updateRankExpiration.calledWith(ranks2.ranks[0].id, ranks1.ranks[0].expirationTime).mockRejectedValue(new UserRankNotFoundError())
    mockRankStore.removeUserRank.calledWith(expectObject<RemoveUserRankArgs>({ rank: 'ban', primaryUserId: aggregateUser })).mockRejectedValue(new UserRankNotFoundError())
    mockRankStore.addUserRank.calledWith(expectObject<AddUserRankArgs>({ rank: 'member', primaryUserId: aggregateUser })).mockRejectedValue(new UserRankAlreadyExistsError())

    // act
    const result = await rankService.mergeRanks(defaultUser, aggregateUser, ['ban'], '')

    // assert
    expect(result.warnings).toBe(5)

    const mergeResult = single(result.individualResults)
    expect(mergeResult.oldRanks.length).toBe(0)
    expect(mergeResult.additions.length).toBe(0)
    expect(mergeResult.extensions.length).toBe(0)
    expect(mergeResult.unchanged.length).toBe(0)
    expect(mergeResult.removals.length).toBe(0)
  })
})
