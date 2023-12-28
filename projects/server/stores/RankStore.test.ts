import { Dependencies } from '@rebel/shared/context/context'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import { Db } from '@rebel/server/providers/DbProvider'
import RankStore, { AddUserRankArgs, RankEventData, RemoveUserRankArgs, UserRankWithRelations } from '@rebel/server/stores/RankStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { addTime } from '@rebel/shared/util/datetime'
import { Rank, RankName } from '@prisma/client'
import { expectArray, expectObject, expectObjectDeep, nameof } from '@rebel/shared/testUtils'
import { single, sortBy, unique } from '@rebel/shared/util/arrays'
import { UserRankNotFoundError, UserRankAlreadyExistsError, UserRankRequiresStreamerError, NotFoundError } from '@rebel/shared/util/error'


export default () => {
  const time1 = data.time1
  const time2 = data.time2
  const time3 = data.time3
  const time4 = addTime(data.time3, 'hours', 1)
  const time5 = addTime(data.time3, 'hours', 2)
  const time6 = addTime(data.time3, 'hours', 3)
  let user1: number
  let user2: number
  let user3: number
  let user4: number
  let registeredUser1: number
  let registeredUser2: number
  let streamer1: number
  let streamer2: number
  let streamer1Name = 'name1'
  let streamer2Name = 'name2'
  let ownerRank: Rank
  let famousRank: Rank
  let modRank: Rank
  let bannedRank: Rank
  let mutedRank: Rank
  let donatorRank: Rank

  let db: Db
  let mockDateTimeHelpers: MockProxy<DateTimeHelpers>
  let rankStore: RankStore

  beforeEach(async () => {
    mockDateTimeHelpers = mock()

    const dbProvider = await startTestDb()

    rankStore = new RankStore(new Dependencies({
      dbProvider,
      dateTimeHelpers: mockDateTimeHelpers
    }))
    db = dbProvider.get()

    user1 = (await db.chatUser.create({ data: {}})).id
    user2 = (await db.chatUser.create({ data: {}})).id
    user3 = (await db.chatUser.create({ data: {}})).id
    user4 = (await db.chatUser.create({ data: {}})).id
    streamer1 = (await db.streamer.create({ data: { registeredUser: { create: { username: streamer1Name, hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}})).id
    streamer2 = (await db.streamer.create({ data: { registeredUser: { create: { username: streamer2Name, hashedPassword: 'pass2', aggregateChatUser: { create: {}} }}}})).id

    ownerRank = await db.rank.create({ data: { name: 'owner', displayNameNoun: '', displayNameAdjective: '', group: 'administration' }})
    famousRank = await db.rank.create({ data: { name: 'famous', displayNameNoun: '', displayNameAdjective: '', group: 'cosmetic' }})
    modRank = await db.rank.create({ data: { name: 'mod', displayNameNoun: '', displayNameAdjective: '', group: 'administration' }})
    bannedRank = await db.rank.create({ data: { name: 'ban', displayNameNoun: '', displayNameAdjective: '', group: 'punishment' }})
    mutedRank = await db.rank.create({ data: { name: 'mute', displayNameNoun: '', displayNameAdjective: '', group: 'punishment' }})
    donatorRank = await db.rank.create({ data: { name: 'donator', displayNameNoun: '', displayNameAdjective: '', group: 'donation' }})

    await rankStore.initialise()
  }, DB_TEST_TIMEOUT)

  afterEach(() => {
    stopTestDb()
  })

  describe(nameof(RankStore, 'addOrUpdateCustomRankName'), () => {
    test('Adds the new custom rank to the database', async () => {
      await db.customRankName.createMany({ data: [
        { userId: user1, isActive: true, name: 'test1', rankId: famousRank.id, streamerId: streamer2 }, // wrong streamer
        { userId: user2, isActive: true, name: 'test2', rankId: famousRank.id, streamerId: streamer1 }, // wrong user
      ]})

      await rankStore.addOrUpdateCustomRankName(streamer1, user1, famousRank.name, 'test3', true)

      await expectRowCount(db.customRankName).toBe(3)
    })

    test('Updates the existing custom name', async () => {
      await db.customRankName.createMany({ data: [
        { userId: user1, isActive: true, name: 'test1', rankId: famousRank.id, streamerId: streamer1 },
        { userId: user1, isActive: true, name: 'test2', rankId: famousRank.id, streamerId: streamer2 }, // wrong streamer
        { userId: user2, isActive: true, name: 'test3', rankId: famousRank.id, streamerId: streamer1 }, // wrong user
      ]})

      await rankStore.addOrUpdateCustomRankName(streamer1, user1, famousRank.name, 'test4', false)

      await expectRowCount(db.customRankName).toBe(3)
      const firstEntry = await db.customRankName.findFirst()
      expect(firstEntry).toEqual(expectObject(firstEntry, { name: 'test4', isActive: false }))
    })
  })

  describe(nameof(RankStore, 'addRankEvent'), () => {
    test('Adds the rank event with data to the db', async () => {
      const eventData: RankEventData = {
        version: 1,
        ignoreOptions: { youtubeChannelId: 3 },
        youtubeRankResults: [{ youtubeChannelId: 5, error: null }, { youtubeChannelId: 6, error: 'test' }],
        twitchRankResults: [{ twitchChannelId: 5, error: null }, { twitchChannelId: 6, error: 'test' }]
      }

      await rankStore.addRankEvent(streamer2, user2, true, 'ban', eventData)

      const storedData = await db.rankEvent.findMany({}).then(single)
      expect(storedData).toEqual(expectObject(storedData, {
        isAdded: true,
        rankId: bannedRank.id,
        serialisedData: expect.any(String)
      }))
    })

    test('Adds the rank event without data', async () => {
      await rankStore.addRankEvent(streamer2, user2, true, 'ban', null)

      const storedData = await db.rankEvent.findMany({}).then(single)
      expect(storedData).toEqual(expectObject(storedData, {
        isAdded: true,
        rankId: bannedRank.id,
        serialisedData: null
      }))
    })
  })

  describe(nameof(RankStore, 'addUserRank'), () => {
    test('Adds rank to user within the streamer context and with no description and expiration time', async () => {
      mockDateTimeHelpers.now.calledWith().mockReturnValue(time1)
      const args: AddUserRankArgs = {
        primaryUserId: user1,
        streamerId: streamer1,
        assignee: null,
        rank: 'famous',
        message: null,
        expirationTime: null
      }

      const result = await rankStore.addUserRank(args)

      await expectRowCount(db.userRank).toBe(1)
      expect(result).toEqual(expectObject<UserRankWithRelations>({
        primaryUserId: args.primaryUserId,
        streamerId: streamer1,
        streamerName: streamer1Name,
        assignedByUserId: args.assignee,
        issuedAt: time1,
        message: null,
        expirationTime: null,
        revokeMessage: null,
        revokedByUserId: null,
        revokedTime: null,
        rank: expectObject<Rank>({
          id: famousRank.id
        })
      }))
    })

    test('Adds rank to user within the streamer context and with description and expiration time', async () => {
      mockDateTimeHelpers.now.calledWith().mockReturnValue(time1)
      const args: AddUserRankArgs = {
        primaryUserId: user1,
        streamerId: streamer1,
        assignee: user2,
        rank: 'mod',
        message: 'You can be a mod for today',
        expirationTime: time2
      }

      const result = await rankStore.addUserRank(args)

      await expectRowCount(db.userRank).toBe(1)
      expect(result).toEqual(expectObject<UserRankWithRelations>({
        primaryUserId: args.primaryUserId,
        streamerId: streamer1,
        streamerName: streamer1Name,
        assignedByUserId: args.assignee,
        issuedAt: time1,
        message: args.message,
        expirationTime: args.expirationTime,
        revokeMessage: null,
        revokedByUserId: null,
        revokedTime: null,
        rank: expectObject<Rank>({
          id: modRank.id
        })
      }))
    })

    test('Throws UserRankAlreadyExistsError if the user-rank already exists for the streamer', async () => {
      await db.userRank.create({ data: {
        userId: user1,
        streamerId: streamer1,
        issuedAt: time1,
        rankId: ownerRank.id
      }})

      const args: AddUserRankArgs = {
        primaryUserId: user1,
        streamerId: streamer1,
        rank: ownerRank.name,
        message: null,
        assignee: null,
        expirationTime: null
      }
      mockDateTimeHelpers.now.calledWith().mockReturnValue(time2)

      await expect(async () => await rankStore.addUserRank(args)).rejects.toThrowError(UserRankAlreadyExistsError)
    })

    test('Allows adding the rank if the user-rank already exists for another streamer', async () => {
      await db.userRank.create({ data: {
        userId: user1,
        streamerId: streamer1,
        issuedAt: time1,
        rankId: modRank.id
      }})

      mockDateTimeHelpers.now.calledWith().mockReturnValue(time1)
      const args: AddUserRankArgs = {
        primaryUserId: user1,
        streamerId: streamer2,
        assignee: user2,
        rank: modRank.name,
        message: null,
        expirationTime: null
      }

      const result = await rankStore.addUserRank(args)

      await expectRowCount(db.userRank).toBe(2)
      expect(result).toEqual(expectObject<UserRankWithRelations>({
        primaryUserId: args.primaryUserId,
        streamerId: streamer2,
        streamerName: streamer2Name,
        assignedByUserId: args.assignee,
        issuedAt: time1,
        message: args.message,
        expirationTime: args.expirationTime,
        revokeMessage: null,
        revokedByUserId: null,
        revokedTime: null,
        rank: expectObject<Rank>({
          id: modRank.id
        })
      }))
    })

    test('Allows adding the global rank if the user-rank already exists for any streamer', async () => {
      await db.userRank.create({ data: {
        userId: user1,
        streamerId: streamer1,
        issuedAt: time1,
        rankId: famousRank.id
      }})

      mockDateTimeHelpers.now.calledWith().mockReturnValue(time1)
      const args: AddUserRankArgs = {
        primaryUserId: user1,
        streamerId: null,
        assignee: user2,
        rank: famousRank.name,
        message: null,
        expirationTime: null
      }

      const result = await rankStore.addUserRank(args)

      await expectRowCount(db.userRank).toBe(2)
      expect(result).toEqual(expectObject<UserRankWithRelations>({
        primaryUserId: args.primaryUserId,
        streamerId: null,
        streamerName: null,
        assignedByUserId: args.assignee,
        issuedAt: time1,
        message: args.message,
        expirationTime: args.expirationTime,
        revokeMessage: null,
        revokedByUserId: null,
        revokedTime: null,
        rank: expectObject<Rank>({
          id: famousRank.id
        })
      }))
    })

    test('Allows adding a duplicate rank if the existing one is no longer active', async () => {
      await db.userRank.createMany({
        data: [
          { userId: user1, issuedAt: time1, rankId: famousRank.id, expirationTime: time2 },
          { userId: user1, issuedAt: time3, rankId: famousRank.id, revokedTime: time4 },
        ]
      })

      const args: AddUserRankArgs = {
        primaryUserId: user1,
        streamerId: null,
        rank: famousRank.name,
        message: null,
        assignee: null,
        expirationTime: null
      }
      mockDateTimeHelpers.now.calledWith().mockReturnValue(time5)

      const result = await rankStore.addUserRank(args)

      await expectRowCount(db.userRank).toBe(3)
      expect(result).toEqual(expectObject<UserRankWithRelations>({
        primaryUserId: args.primaryUserId,
        streamerId: null,
        streamerName: null,
        assignedByUserId: args.assignee,
        issuedAt: time5,
        message: args.message,
        expirationTime: args.expirationTime,
        revokeMessage: null,
        revokedByUserId: null,
        revokedTime: null,
        rank: expectObject<Rank>({
          id: famousRank.id
        })
      }))
    })

    test('Throws if attempting to add a global user-rank for a rank that requires a streamer context', async () => {
      const args: AddUserRankArgs = {
        primaryUserId: user1,
        streamerId: null,
        rank: modRank.name,
        message: null,
        assignee: null,
        expirationTime: null
      }
      mockDateTimeHelpers.now.calledWith().mockReturnValue(time2)

      await expect(async () => await rankStore.addUserRank(args)).rejects.toThrowError(UserRankRequiresStreamerError)
    })
  })

  describe(nameof(RankStore, 'deleteCustomRankName'), () => {
    test('Deletes the custom rank name from the database', async () => {
      await db.customRankName.createMany({ data: [
        { userId: user1, isActive: true, name: 'test1', rankId: famousRank.id, streamerId: streamer1 },
        { userId: user1, isActive: true, name: 'test2', rankId: famousRank.id, streamerId: streamer2 }, // wrong streamer
        { userId: user2, isActive: true, name: 'test3', rankId: famousRank.id, streamerId: streamer1 }, // wrong user
      ]})

      await rankStore.deleteCustomRankName(streamer1, user1, 'famous')

      const stored = await db.customRankName.findMany()
      expect(stored.length).toBe(2)
      expect(stored).toEqual(expectObject(stored, [{ userId: user1, streamerId: streamer2 }, { userId: user2 }]))
    })

    test('Throws if no custom rank name exists', async () => {
      await db.customRankName.createMany({ data: [
        { userId: user1, isActive: true, name: 'test1', rankId: donatorRank.id, streamerId: streamer1 },
        { userId: user1, isActive: true, name: 'test2', rankId: famousRank.id, streamerId: streamer2 }, // wrong streamer
        { userId: user2, isActive: true, name: 'test3', rankId: famousRank.id, streamerId: streamer1 }, // wrong user
      ]})

      await expect(() => rankStore.deleteCustomRankName(streamer1, user1, 'famous')).rejects.toThrowError(NotFoundError)
    })
  })

  describe(nameof(RankStore, 'getCustomRankNamesForUsers'), () => {
    test('Returns the active custom rank names for the given users in the context of the specified streamer', async () => {
      await db.customRankName.createMany({ data: [
        { userId: user1, isActive: true, name: 'test1', rankId: donatorRank.id, streamerId: streamer1 },
        { userId: user1, isActive: true, name: 'test2', rankId: bannedRank.id, streamerId: streamer2 }, // wrong streamer
        { userId: user1, isActive: true, name: 'test3', rankId: famousRank.id, streamerId: streamer1 },
        { userId: user2, isActive: true, name: 'test4', rankId: modRank.id, streamerId: streamer1 },
        { userId: user3, isActive: true, name: 'test5', rankId: mutedRank.id, streamerId: streamer1 }, // wrong user
      ]})

      const result = await rankStore.getCustomRankNamesForUsers(streamer1, [user1, user2])

      expect(result).toEqual([
        { primaryUserId: user1, customRankNames: { [donatorRank.name]: 'test1', [famousRank.name]: 'test3' }},
        { primaryUserId: user2, customRankNames: { [modRank.name]: 'test4' }}
      ])
    })

    test('Returns empty rank names object if the user does not have any active custom ranks', async () => {
      await db.customRankName.create({ data: { userId: user1, isActive: false, name: 'test', rankId: donatorRank.id, streamerId: streamer1 }})

      const result = await rankStore.getCustomRankNamesForUsers(streamer1, [user1, user2])

      expect(result).toEqual([{ primaryUserId: user1, customRankNames: {} }, { primaryUserId: user2, customRankNames: {} }])
    })
  })

  describe(nameof(RankStore, 'getRanks'), () => {
    test('Returns Standard ranks', async () => {
      const result = await rankStore.getRanks()

      expect(result).toEqual(expectArray([famousRank, donatorRank]))
    })
  })

  describe(nameof(RankStore, 'getRankEventsSince'), () => {
    test('Returns rank events since the specified time and deserialises the data correctly', async () => {
      const eventData: RankEventData = {
        version: 1,
        ignoreOptions: { youtubeChannelId: 3 },
        youtubeRankResults: [{ youtubeChannelId: 5, error: null }, { youtubeChannelId: 6, error: 'test' }],
        twitchRankResults: [{ twitchChannelId: 5, error: null }, { twitchChannelId: 6, error: 'test' }]
      }
      await rankStore.addRankEvent(streamer1, user1, true, 'ban', eventData)
      await rankStore.addRankEvent(streamer1, user2, false, 'mute', null)
      await rankStore.addRankEvent(streamer1, user1, true, 'mod', null) // too early
      await rankStore.addRankEvent(streamer2, user1, true, 'mod', null) // wrong streamer

      await db.rankEvent.update({ where: { id: 1 }, data: { time: data.time2 }})
      await db.rankEvent.update({ where: { id: 2 }, data: { time: data.time3 }})
      await db.rankEvent.update({ where: { id: 3 }, data: { time: data.time1 }})
      await db.rankEvent.update({ where: { id: 4 }, data: { time: data.time4 }})

      const result = await rankStore.getRankEventsSince(streamer1, data.time1.getTime())

      expect(result).toEqual(expectObjectDeep(result, [{
        isAdded: true,
        rank: { name: 'ban' },
        data: eventData,
        userId: user1
      }, {
        isAdded: false,
        rank: { name: 'mute' },
        data: null,
        userId: user2
      }]))
    })
  })

  describe(nameof(RankStore, 'getUserRankById'), () => {
    test('Returns the correct rank', async () => {
      await db.userRank.createMany({ data: [
        {
          userId: user1,
          issuedAt: time1,
          rankId: ownerRank.id
        }, {
          userId: user2,
          issuedAt: time2,
          rankId: famousRank.id
        }
      ]})

      const result = await rankStore.getUserRankById(2)

      expect(result.id).toBe(2)
      expect(result.rank).toEqual(expect.objectContaining(famousRank))
    })

    test('Throws if the rank does not exist', async () => {
      await db.userRank.create({ data: {
        userId: user1,
        issuedAt: time1,
        rankId: ownerRank.id
      }})

      await expect(() => rankStore.getUserRankById(2)).rejects.toThrowError(UserRankNotFoundError)
    })
  })

  describe(nameof(RankStore, 'getUserRanks'), () => {
    test('Returns empty array if no user-ranks are present for the specified users', async () => {
      mockDateTimeHelpers.now.calledWith().mockReturnValue(time2)
      await db.userRank.createMany({ data: [
        { userId: user1, streamerId: null, issuedAt: time1, rankId: ownerRank.id }, // wrong user
        { userId: user2, streamerId: 1, issuedAt: time1, rankId: ownerRank.id } // wrong streamer
      ]})

      const result = await rankStore.getUserRanks([user2, user3], null)

      expect(result.length).toBe(2)
      expect(result[0].ranks.length).toBe(0)
      expect(result[1].ranks.length).toBe(0)
    })

    test('Returns all ranks for multiple users that are global or within the context of the given streamer', async () => {
      mockDateTimeHelpers.now.calledWith().mockReturnValue(time2)
      await db.userRank.createMany({
        data: [
          { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: ownerRank.id }, // match (streamer context)
          { userId: user1, streamerId: streamer1, issuedAt: time2, rankId: modRank.id }, // match (streamer context)
          { userId: user2, streamerId: null, issuedAt: time3, rankId: famousRank.id }, // match (global)
          { userId: user3, streamerId: streamer2, issuedAt: time3, rankId: modRank.id } // miss (wrong streamer)
        ]
      })

      const result = await rankStore.getUserRanks([user1, user2, user3], streamer1)

      expect(result.length).toBe(3)
      expect(result[0].ranks.length).toBe(2)
      expect(result[1].ranks.length).toBe(1)
      expect(result[2].ranks.length).toBe(0)
    })

    test('Ignores inactive ranks', async () => {
      mockDateTimeHelpers.now.calledWith().mockReturnValue(time6)
      await db.userRank.createMany({
        data: [
          { userId: user1, issuedAt: time1, rankId: famousRank.id, expirationTime: time2 },
          { userId: user1, issuedAt: time3, rankId: ownerRank.id, revokedTime: time4 },
          { userId: user1, issuedAt: time5, rankId: modRank.id }, // the only active rank
          { userId: user2, issuedAt: time1, rankId: modRank.id, expirationTime: time2 },
          { userId: user2, issuedAt: time3, rankId: ownerRank.id, revokedTime: time4 },
        ]
      })

      const result = await rankStore.getUserRanks([1, 2], null)

      expect(result.length).toBe(2)
      expect(single(result[0].ranks).rank).toEqual(expect.objectContaining(modRank))
      expect(result[1].ranks.length).toBe(0)
    })
  })

  describe(nameof(RankStore, 'getAllUserRanks'), () => {
    test('Returns current ranks across all streamers', async () => {
      mockDateTimeHelpers.now.calledWith().mockReturnValue(time6)

      // user 1: muted, user 2: muted and banned
      await db.userRank.createMany({
        data: [
          { userId: user1, streamerId: streamer2, issuedAt: time1, rankId: famousRank.id }, // other streamer
          { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: famousRank.id },
          { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: ownerRank.id },
          { userId: user1, streamerId: null,      issuedAt: time1, rankId: mutedRank.id }, // global rank should be returned
          { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: modRank.id, revokedTime: time2 },
          { userId: user2, streamerId: streamer1, issuedAt: time1, rankId: mutedRank.id, expirationTime: time2 },
          { userId: user2, streamerId: streamer1, issuedAt: time1, rankId: bannedRank.id, revokedTime: time4 },
          { userId: user2, streamerId: streamer1, issuedAt: time2, rankId: mutedRank.id },
          { userId: user2, streamerId: streamer1, issuedAt: time1, rankId: bannedRank.id },
        ]
      })

      let result = await rankStore.getAllUserRanks(user1)

      const ranks = sortBy(result.ranks, r => `${r.streamerId}${r.rank}`)
      expect(ranks.length).toBe(4)
      expect(ranks[0].streamerId).toBe(streamer1)
      expect(ranks[0].rank.name).toBe('famous')
      expect(ranks[1].streamerId).toBe(streamer1)
      expect(ranks[1].rank.name).toBe('owner')
      expect(ranks[2].streamerId).toBe(streamer2)
      expect(ranks[2].rank.name).toBe('famous')
      expect(ranks[3].streamerId).toBe(null)
      expect(ranks[3].rank.name).toBe('mute')
    })
  })

  describe(nameof(RankStore, 'getUserRanksForGroup'), () => {
    test('Returns active user ranks of the specified group', async () => {
      mockDateTimeHelpers.now.calledWith().mockReturnValue(time6)

      // user 1: muted, user 2: muted and banned
      await db.userRank.createMany({
        data: [
          { userId: user1, streamerId: streamer2, issuedAt: time1, rankId: famousRank.id }, // wrong streamer
          { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: famousRank.id },
          { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: ownerRank.id },
          { userId: user1, streamerId: null,      issuedAt: time1, rankId: mutedRank.id }, // global rank should be returned
          { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: modRank.id, revokedTime: time2 },
          { userId: user2, streamerId: streamer1, issuedAt: time1, rankId: mutedRank.id, expirationTime: time2 },
          { userId: user2, streamerId: streamer1, issuedAt: time1, rankId: bannedRank.id, revokedTime: time4 },
          { userId: user2, streamerId: streamer1, issuedAt: time2, rankId: mutedRank.id },
          { userId: user2, streamerId: streamer1, issuedAt: time1, rankId: bannedRank.id },
        ]
      })

      let result = await rankStore.getUserRanksForGroup('punishment', streamer1)

      result = sortBy(result, r => `${r.primaryUserId}${r.rank}`)
      expect(result.length).toBe(3)
      expect(result[0].primaryUserId).toBe(user1)
      expect(result[0].rank.name).toBe('mute')
      expect(result[1].primaryUserId).toBe(user2)
      expect(result[1].rank.name).toBe('ban')
      expect(result[2].primaryUserId).toBe(user2)
      expect(result[2].rank.name).toBe('mute')
    })
  })

  describe(nameof(RankStore, 'getUserRankHistory'), () => {
    test('Gets all user-rank changes for the specified user, sorted in descending order', async () => {
      await db.userRank.createMany({
        data: [
          { userId: user1, streamerId: null,      issuedAt: time2, rankId: modRank.id, revokedTime: time3 },
          { userId: user2, streamerId: streamer1, issuedAt: time2, rankId: mutedRank.id }, // user 2
          { userId: user1, streamerId: streamer1, issuedAt: time5, rankId: modRank.id },
          { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: famousRank.id },
          { userId: user1, streamerId: streamer2, issuedAt: time1, rankId: famousRank.id }, // wrong streamer
          { userId: user2, streamerId: streamer1, issuedAt: time1, rankId: bannedRank.id, revokedTime: time4 }, // user 2
          { userId: user1, streamerId: streamer1, issuedAt: time3, rankId: mutedRank.id, expirationTime: time4 },
        ]
      })

      const result = await rankStore.getUserRankHistory(user1, streamer1)

      expect(result.length).toBe(4)
      expect(single(unique(result.map(r => r.primaryUserId)))).toBe(user1)
      expect(result.map(r => r.rank.name)).toEqual(expect.arrayContaining<RankName>(['famous', 'mod', 'mod', 'mute']))
    })
  })

  describe(nameof(RankStore, 'relinkAdminUsers'), () => {
    test('Relinks the correct user ids', async () => {
      await db.userRank.createMany({ data: [
        { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: modRank.id },
        { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: mutedRank.id, assignedByUserId: user2 },
        { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: famousRank.id, assignedByUserId: user3 },
        { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: bannedRank.id, revokedByUserId: user2 },
        { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: donatorRank.id, revokedByUserId: user3 },
      ]})

      await rankStore.relinkAdminUsers(user2, user4)

      const stored = await db.userRank.findMany()
      expect(stored).toEqual(expectObject(stored, [
        { assignedByUserId: null, revokedByUserId: null },
        { assignedByUserId: user4, revokedByUserId: null },
        { assignedByUserId: user3, revokedByUserId: null },
        { assignedByUserId: null, revokedByUserId: user4 },
        { assignedByUserId: null, revokedByUserId: user3 },
      ]))
    })
  })

  describe(nameof(RankStore, 'relinkCustomRankNames'), () => {
    test('Relinks the correct user ids', async () => {
      await db.customRankName.createMany({ data: [
        { streamerId: streamer1, rankId: donatorRank.id, userId: user1, isActive: true, name: 'test' },
        { streamerId: streamer2, rankId: donatorRank.id, userId: user1, isActive: true, name: 'test' },
        { streamerId: streamer1, rankId: donatorRank.id, userId: user2, isActive: true, name: 'test' }
      ]})

      await rankStore.relinkCustomRankNames(user1, user3)

      const stored = await db.customRankName.findMany()
      expect(stored).toEqual(expectObject(stored, [{ userId: user3 }, { userId: user3 }, { userId: user2 }]))
    })
  })

  describe(nameof(RankStore, 'removeUserRank'), () => {
    test('Throws UserRankNotFoundError if no active rank of the specified type exists for the user', async () => {
      await db.userRank.createMany({
        data: [
          { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: famousRank.id, expirationTime: time2 }, // expired
          { userId: user1, streamerId: streamer1, issuedAt: time3, rankId: famousRank.id, revokedTime: time4 }, // revoked
          { userId: user1, streamerId: streamer2, issuedAt: time3, rankId: famousRank.id }, // wrong streamer
          { userId: user1, streamerId: null,      issuedAt: time3, rankId: famousRank.id } // global rank, but we want to remove a streamer rank
        ]
      })

      const args: RemoveUserRankArgs = {
        primaryUserId: user1,
        streamerId: streamer1,
        message: 'Test',
        rank: 'famous',
        removedBy: user2
      }
      mockDateTimeHelpers.now.calledWith().mockReturnValue(time6)

      await expect(() => rankStore.removeUserRank(args)).rejects.toThrowError(UserRankNotFoundError)
    })

    test('Revokes the rank', async () => {
      await db.userRank.createMany({
        data: [
          { userId: user1, streamerId: streamer1, issuedAt: time1, rankId: famousRank.id, expirationTime: time2 },
          { userId: user1, streamerId: streamer1, issuedAt: time3, rankId: famousRank.id, revokedTime: time4 },
          { userId: user1, streamerId: streamer2, issuedAt: time5, rankId: famousRank.id }, // streamer 2
          { userId: user1, streamerId: streamer1, issuedAt: time5, rankId: famousRank.id },
        ]
      })

      const args: RemoveUserRankArgs = {
        primaryUserId: user1,
        streamerId: streamer1,
        message: 'Test',
        rank: 'famous',
        removedBy: user2
      }
      mockDateTimeHelpers.now.calledWith().mockReturnValue(time6)

      const result = await rankStore.removeUserRank(args)

      await expectRowCount(db.userRank).toBe(4)
      expect(result).toEqual(expectObject<UserRankWithRelations>({
        primaryUserId: args.primaryUserId,
        streamerId: args.streamerId,
        streamerName: streamer1Name,
        assignedByUserId: null,
        issuedAt: time5,
        message: null,
        expirationTime: null,
        revokeMessage: args.message,
        revokedByUserId: args.removedBy,
        revokedTime: time6,
        rank: expectObject<Rank>({
          id: famousRank.id
        })
      }))
    })
  })

  describe(nameof(RankStore, 'updateRankExpiration'), () => {
    test('Sets time correctly', async () => {
      const rank = await db.userRank.create({ data: { userId: user1, issuedAt: time5, rankId: famousRank.id } })

      const result = await rankStore.updateRankExpiration(rank.id, data.time1)

      expect(result.expirationTime).toEqual(data.time1)
    })

    test('Throws error if rank was not found', async () => {
      await expect(() => rankStore.updateRankExpiration(1, null)).rejects.toThrowError(UserRankNotFoundError)
    })
  })
}
