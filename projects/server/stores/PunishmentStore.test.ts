import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import PunishmentStore, { CreatePunishmentArgs } from '@rebel/server/stores/PunishmentStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb } from '@rebel/server/_test/db'
import { nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { mock } from 'jest-mock-extended'
import { activeTimeout, expiredTimeout, activeBan, revokedBan } from '@rebel/server/services/PunishmentService.test'
import * as data from '@rebel/server/_test/testData'
import { Punishment, PunishmentType } from '@prisma/client'
import { ADMIN_YOUTUBE_ID } from '@rebel/server/stores/ChannelStore'

export default () => {
  let db: Db
  let punishmentstore: PunishmentStore

  beforeEach(async () => {
    const dbProvider = await startTestDb()

    punishmentstore = new PunishmentStore(new Dependencies({
      dbProvider
    }))
    db = dbProvider.get()

    await db.chatUser.create({ data: { youtubeChannels: { create: { youtubeId: ADMIN_YOUTUBE_ID }}}}) // user 1
    await db.chatUser.create({data: {}}) // user 2
    await db.chatUser.create({data: {}}) // user 3

    await punishmentstore.initialise()
  }, DB_TEST_TIMEOUT)

  afterEach(() => {
    stopTestDb()
  })

  describe(nameof(PunishmentStore, 'addPunishment'), () => {
    test('adds punishment to the database', async () => {
      const args: CreatePunishmentArgs = {
        userId: 2,
        type: 'timeout',
        issuedAt: data.time1,
        message: 'test',
        expirationTime: data.time2
      }

      await punishmentstore.addPunishment(args)

      const stored = single(await db.punishment.findMany())
      expect(stored).toEqual<Punishment>({
        id: 1,
        userId: 2,
        adminUserId: 1,
        punishmentType: args.type,
        issuedAt: args.issuedAt,
        message: args.message,
        expirationTime: args.expirationTime,
        revokeMessage: null,
        revokedTime: null
      })
    })
  })

  describe(nameof(PunishmentStore, 'getPunishments'), () => {
    test('returns all punishments', async () => {
      await db.punishment.createMany({ data: [
        { ...getCreateArgs('ban') },
        { ...getCreateArgs('timeout'), userId: 3 },
        { ...getCreateArgs('ban'), userId: 3 }
      ]})
      
      const result = await punishmentstore.getPunishments()

      expect(result.length).toBe(3)
    })
  })

  describe(nameof(PunishmentStore, 'getPunishmentsForUser'), () => {
    test('returns empty array if there are no punishments for user', async () => {
      await db.punishment.create({ data: { ...getCreateArgs('ban') }})

      const result = await punishmentstore.getPunishmentsForUser(3)

      expect(result.length).toBe(0)
    })

    test('returns all punishments for specified user', async () => {
      await db.punishment.createMany({ data: [
        { ...getCreateArgs('ban') },
        { ...getCreateArgs('timeout'), userId: 3 },
        { ...getCreateArgs('ban'), userId: 3 }
      ]})

      const result = await punishmentstore.getPunishmentsForUser(3)

      expect(result.length).toBe(2)
    })
  })

  describe(nameof(PunishmentStore, 'revokePunishment'), () => {
    test(`throws if punishment of given ID doesn't exist`, async () => {
      await db.punishment.create({ data: { ...getCreateArgs('ban') }})

      await expect(() => punishmentstore.revokePunishment(2, new Date(), 'test')).rejects.toThrow()
    })

    test('throws if already revoked', async () => {
      await db.punishment.create({ data: { ...getCreateArgs('ban'), revokedTime: data.time2 }})

      await expect(() => punishmentstore.revokePunishment(1, new Date(), 'test')).rejects.toThrow()
    })

    test('sets revoked column to the given values', async () => {
      await db.punishment.create({ data: { ...getCreateArgs('ban') }})
      const revokeTime = data.time2
      const revokeMessage = 'test'

      const result = await punishmentstore.revokePunishment(1, revokeTime, revokeMessage)

      const entry = single(await db.punishment.findMany())
      expect(entry.revokedTime).toEqual(revokeTime)
      expect(entry.revokeMessage).toEqual(revokeMessage)
      expect(result.revokedTime).toEqual(revokeTime)
      expect(result.revokeMessage).toEqual(revokeMessage)
    })
  })
}

function getCreateArgs (type: PunishmentType) {
  return {
    issuedAt: data.time1,
    punishmentType: type,
    adminUserId: 1,
    userId: 2
  }
}