import { Dependencies } from '@rebel/server/context/context'
import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import { Db } from '@rebel/server/providers/DbProvider'
import { ADMIN_YOUTUBE_ID } from '@rebel/server/stores/ChannelStore'
import PunishmentStore from '@rebel/server/stores/PunishmentStore'
import RankStore, { AddUserRankArgs, RemoveUserRankArgs } from '@rebel/server/stores/RankStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import { addTime } from '@rebel/server/util/datetime'
import { Rank, UserRank } from '@prisma/client'
import { nameof, single } from '@rebel/server/_test/utils'


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
  let ownerRank: Rank
  let famousRank: Rank
  let modRank: Rank

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

    ownerRank = await db.rank.create({ data: { name: 'owner', displayName: 'owner', group: 'administration' }})
    famousRank = await db.rank.create({ data: { name: 'famous', displayName: 'famous', group: 'cosmetic' }})
    modRank = await db.rank.create({ data: { name: 'mod', displayName: 'mod', group: 'administration' }})

    await rankStore.initialise()
  }, DB_TEST_TIMEOUT)

  afterEach(() => {
    stopTestDb()
  })

  describe(nameof(RankStore, 'addUserRank'), () => {
    test('Adds rank to user with no description and expiration time', async () => {
      mockDateTimeHelpers.now.mockReturnValue(time1)
      const args: AddUserRankArgs = {
        userId: user1,
        assignee: null,
        rank: 'famous',
        message: null,
        expirationTime: null
      }

      await rankStore.addUserRank(args)

      expectRowCount(db.userRank).toBe(1)
      const saved = (await db.userRank.findFirst())!
      expect(saved).toEqual(expect.objectContaining<Omit<UserRank, 'id'>>({
        userId: args.userId,
        assignedByUserId: args.assignee,
        rankId: famousRank.id,
        issuedAt: time1,
        message: null,
        expirationTime: null,
        revokeMessage: null,
        revokedByUserId: null,
        revokedTime: null
      }))
    })

    test('Adds rank to user with description and expiration time', async () => {
      mockDateTimeHelpers.now.mockReturnValue(time1)
      const args: AddUserRankArgs = {
        userId: user1,
        assignee: user2,
        rank: 'mod',
        message: 'You can be a mod for today',
        expirationTime: time2
      }

      await rankStore.addUserRank(args)

      expectRowCount(db.userRank).toBe(1)
      const saved = (await db.userRank.findFirst())!
      expect(saved).toEqual(expect.objectContaining<Omit<UserRank, 'id'>>({
        userId: args.userId,
        assignedByUserId: args.assignee,
        rankId: modRank.id,
        issuedAt: time1,
        message: args.message,
        expirationTime: args.expirationTime,
        revokeMessage: null,
        revokedByUserId: null,
        revokedTime: null
      }))
    })

    test('Throws if the user-rank already exists', async () => {
      await db.userRank.create({ data: {
        userId: user1,
        issuedAt: time1,
        rankId: ownerRank.id
      }})

      const args: AddUserRankArgs = {
        userId: user1,
        rank: ownerRank.name,
        message: null,
        assignee: null,
        expirationTime: null
      }
      mockDateTimeHelpers.now.mockReturnValue(time2)

      await expect(async () => await rankStore.addUserRank(args)).rejects.toThrow()
    })

    test('Allows adding a duplicate rank if the existing one is no longer active', async () => {
      await db.userRank.createMany({
        data: [
          { userId: user1, issuedAt: time1, rankId: famousRank.id, expirationTime: time2 },
          { userId: user1, issuedAt: time3, rankId: famousRank.id, revokedTime: time4 },
        ]
      })

      const args: AddUserRankArgs = {
        userId: user1,
        rank: famousRank.name,
        message: null,
        assignee: null,
        expirationTime: null
      }
      mockDateTimeHelpers.now.mockReturnValue(time5)

      await rankStore.addUserRank(args)

      expectRowCount(db.userRank).toBe(3)
      const saved = (await db.userRank.findUnique({ where: { id: 3 }}))!
      expect(saved).toEqual(expect.objectContaining<Omit<UserRank, 'id'>>({
        userId: args.userId,
        assignedByUserId: args.assignee,
        rankId: famousRank.id,
        issuedAt: time5,
        message: args.message,
        expirationTime: args.expirationTime,
        revokeMessage: null,
        revokedByUserId: null,
        revokedTime: null
      }))
    })
  })

  describe(nameof(RankStore, 'getUserRanks'), () => {
    test('Returns empty array if no user-ranks are present for the specified users', async () => {
      mockDateTimeHelpers.now.mockReturnValue(time2)
      await db.userRank.create({ data: {
        userId: user1,
        issuedAt: time1,
        rankId: ownerRank.id
      }})

      const result = await rankStore.getUserRanks([user2, user3])

      expect(result.length).toBe(2)
      expect(result[0].ranks.length).toBe(0)
      expect(result[1].ranks.length).toBe(0)
    })

    test('Returns all ranks for multiple users', async () => {
      mockDateTimeHelpers.now.mockReturnValue(time2)
      await db.userRank.createMany({
        data: [
          { userId: user1, issuedAt: time1, rankId: ownerRank.id },
          { userId: user1, issuedAt: time2, rankId: modRank.id },
          { userId: user2, issuedAt: time3, rankId: famousRank.id }
        ]
      })

      const result = await rankStore.getUserRanks([user1, user2, user3])

      expect(result.length).toBe(3)
      expect(result[0].ranks.length).toBe(2)
      expect(result[1].ranks.length).toBe(1)
      expect(result[2].ranks.length).toBe(0)
    })

    test('Ignores inactive ranks', async () => {
      mockDateTimeHelpers.now.mockReturnValue(time6)
      await db.userRank.createMany({
        data: [
          { userId: user1, issuedAt: time1, rankId: famousRank.id, expirationTime: time2 },
          { userId: user1, issuedAt: time3, rankId: ownerRank.id, revokedTime: time4 },
          { userId: user1, issuedAt: time5, rankId: modRank.id }, // the only active rank
          { userId: user2, issuedAt: time1, rankId: modRank.id, expirationTime: time2 },
          { userId: user2, issuedAt: time3, rankId: ownerRank.id, revokedTime: time4 },
        ]
      })

      const result = await rankStore.getUserRanks([1, 2])

      expect(result.length).toBe(2)
      expect(single(result[0].ranks).rank).toEqual(expect.objectContaining(modRank))
      expect(result[1].ranks.length).toBe(0)
    })
  })

  describe(nameof(RankStore, 'removeUserRank'), () => {
    test('Throws if no active rank of the specified type exists for the user', async () => {
      await db.userRank.createMany({
        data: [
          { userId: user1, issuedAt: time1, rankId: famousRank.id, expirationTime: time2 },
          { userId: user1, issuedAt: time3, rankId: famousRank.id, revokedTime: time4 },
        ]
      })
      
      const args: RemoveUserRankArgs = {
        userId: user1,
        message: 'Test',
        rank: 'famous',
        removedBy: user2
      }
      mockDateTimeHelpers.now.mockReturnValue(time6)

      await expect(() => rankStore.removeUserRank(args)).rejects.toThrow()
    })

    test('Revokes the rank', async () => {
      await db.userRank.createMany({
        data: [
          { userId: user1, issuedAt: time1, rankId: famousRank.id, expirationTime: time2 },
          { userId: user1, issuedAt: time3, rankId: famousRank.id, revokedTime: time4 },
          { userId: user1, issuedAt: time5, rankId: famousRank.id },
        ]
      })
      
      const args: RemoveUserRankArgs = {
        userId: user1,
        message: 'Test',
        rank: 'famous',
        removedBy: user2
      }
      mockDateTimeHelpers.now.mockReturnValue(time6)

      await rankStore.removeUserRank(args)
      
      expectRowCount(db.userRank).toBe(3)
      const saved = (await db.userRank.findUnique({ where: { id: 3 }}))!
      expect(saved).toEqual(expect.objectContaining<Omit<UserRank, 'id'>>({
        userId: args.userId,
        assignedByUserId: null,
        rankId: famousRank.id,
        issuedAt: time5,
        message: null,
        expirationTime: null,
        revokeMessage: args.message,
        revokedByUserId: args.removedBy,
        revokedTime: time6
      }))
    })
  })
}
