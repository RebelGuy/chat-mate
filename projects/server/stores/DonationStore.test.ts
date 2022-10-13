import { Donation } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { New } from '@rebel/server/models/entities'
import { Db } from '@rebel/server/providers/DbProvider'
import DonationStore from '@rebel/server/stores/DonationStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { expectArray, nameof } from '@rebel/server/_test/utils'
import * as data from '@rebel/server/_test/testData'
import { randomInt } from 'crypto'
import { DonationUserLinkAlreadyExistsError, DonationUserLinkNotFoundError } from '@rebel/server/util/error'
import { addTime } from '@rebel/server/util/datetime'
import { single } from '@rebel/server/util/arrays'

export default () => {
  let db: Db
  let donationStore: DonationStore

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    donationStore = new DonationStore(new Dependencies({
      dbProvider
    }))
    db = dbProvider.get()
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(DonationStore, 'addDonation'), () => {
    test('Adds the donation to the database and returns the added item', async () => {
      const donationData: New<Donation> = {
        amount: 1.45,
        formattedAmount: '$1.45',
        currency: 'USD',
        name: 'Test name',
        streamlabsId: 123,
        time: data.time1,
        message: 'This is a test message'
      }

      const result = await donationStore.addDonation(donationData)

      expect(result).toEqual(expect.objectContaining(donationData))
    })
  })

  describe(nameof(DonationStore, 'getDonation'), () => {
    test('Gets unlinked donation', async () => {
      const donation = await createDonation({})

      const result = await donationStore.getDonation(donation.id)

      expect(result.id).toBe(donation.id)
      expect(result.streamlabsUserId).toBeNull()
      expect(result.userId).toBeNull()
    })

    test('Gets donation with internal link', async () => {
      const user1 = await db.chatUser.create({ data: {} })
      const user2 = await db.chatUser.create({ data: {} })
      const donation = await createDonation({}, { userId: user2.id, type: 'internal' })

      const result = await donationStore.getDonation(donation.id)

      expect(result.id).toBe(donation.id)
      expect(result.streamlabsUserId).toBeNull()
      expect(result.userId).toBe(user2.id)
    })

    test('Gets donation with external link', async () => {
      const user1 = await db.chatUser.create({ data: {} })
      const user2 = await db.chatUser.create({ data: {} })
      const donation = await createDonation({}, { userId: user2.id, type: 'streamlabs', streamlabsUser: 5 })

      const result = await donationStore.getDonation(donation.id)

      expect(result.id).toBe(donation.id)
      expect(result.streamlabsUserId).toBe(5)
      expect(result.userId).toBe(user2.id)
    })

    test(`Throws if donation doesn't exist`, async () => {
      await expect(() => donationStore.getDonation(5)).rejects.toThrow()
    })
  })

  describe(nameof(DonationStore, 'getDonationsByUserId'), () => {
    test('Returns ordered donations linked to the given user', async () => {
      const user1 = await db.chatUser.create({ data: {} })
      const user2 = await db.chatUser.create({ data: {} })
      const donation1 = await createDonation({ time: data.time1 }, { userId: user2.id, type: 'internal' })
      const donation2 = await createDonation({ time: data.time2 }, { userId: user1.id, type: 'internal' }) // 2
      const donation3 = await createDonation({ time: data.time1 }, { userId: user1.id, type: 'streamlabs', streamlabsUser: 1 }) // 1
      const donation4 = await createDonation({ time: data.time2 }, { userId: user2.id, type: 'streamlabs', streamlabsUser: 3 })
      const donation5 = await createDonation({ time: data.time3 }, { userId: user1.id, type: 'streamlabs', streamlabsUser: 2 }) // 3
      const donation6 = await createDonation({ time: data.time2 }, { userId: user2.id, type: 'streamlabs', streamlabsUser: 3 })
      const donation7 = await createDonation({ time: addTime(data.time3, 'seconds', 1) })

      const result = await donationStore.getDonationsByUserId(user1.id)

      expect(result.length).toBe(3)
      expect(result).toEqual([donation3, donation2, donation5])
    })
  })

  describe(nameof(DonationStore, 'getDonationsSince'), () => {
    test('Returns ordered donations after the given time', async () => {
      const donation1 = await createDonation({ time: data.time1 })
      const donation2 = await createDonation({ time: data.time3 })
      const donation3 = await createDonation({ time: data.time2 })

      const result = await donationStore.getDonationsSince(donation1.time.getTime())

      expect(result.length).toBe(2)
      expect(result).toEqual([
        { ...donation3, userId: null, linkedAt: null },
        { ...donation2, userId: null, linkedAt: null }
      ])
    })
  })

  describe(nameof(DonationStore, 'getLastStreamlabsId'), () => {
    test('Gets the highest streamlabsId', async () => {
      await createDonation({ streamlabsId: 2 })
      const highestDonation = await createDonation({ streamlabsId: 5 })
      await createDonation({ streamlabsId: 1 })

      const result = await donationStore.getLastStreamlabsId()

      expect(result).toBe(highestDonation.streamlabsId)
    })

    test('Returns null if no entries exist', async () => {
      const result = await donationStore.getLastStreamlabsId()

      expect(result).toBeNull()
    })
  })

  describe(nameof(DonationStore, 'linkUserToDonation'), () => {
    test('Links specified user to the donations (no streamlabs user)', async () => {
      const user = await db.chatUser.create({ data: {}})
      const donation1 = await createDonation({})
      const donation2 = await createDonation({})
      const time = new Date()

      await donationStore.linkUserToDonation(donation1.id, user.id, time)
      await donationStore.linkUserToDonation(donation2.id, user.id, time)

      const streamlabsUsers = await db.streamlabsUser.findMany({})
      expect(streamlabsUsers.length).toBe(2)
      expect(streamlabsUsers[0].linkedUserId).toBe(user.id)
      expect(streamlabsUsers[0].streamlabsUserId).toBe(`internal-${donation1.id}`)
      expect(streamlabsUsers[1].linkedUserId).toBe(user.id)
      expect(streamlabsUsers[1].streamlabsUserId).toBe(`internal-${donation2.id}`)
    })

    test('Links specified user to the donations (via streamlabs user)', async () => {
      const user = await db.chatUser.create({ data: {}})
      const streamlabsUserId = 5
      const donation1 = await createDonation({ streamlabsUserId })
      const donation2 = await createDonation({ streamlabsUserId })
      const time = new Date()

      await donationStore.linkUserToDonation(donation1.id, user.id, time)

      let secondHasFailed = false
      try {
        await donationStore.linkUserToDonation(donation2.id, user.id, time)
      } catch (e) {
        if (e instanceof DonationUserLinkAlreadyExistsError) {
          secondHasFailed = true
        }
      }

      const streamlabsUser = single(await db.streamlabsUser.findMany({}))
      expect(streamlabsUser.linkedUserId).toBe(user.id)
      expect(streamlabsUser.streamlabsUserId).toBe(`external-${streamlabsUserId}`)
      expect(secondHasFailed).toBe(true)
    })

    test('Throws if a user is already linked (no streamlabs user)', async () => {
      const user1 = await db.chatUser.create({ data: {}})
      const user2 = await db.chatUser.create({ data: {}})
      const donation = await createDonation({}, { userId: user1.id, type: 'internal' })
      const time = new Date()

      await expect(() => donationStore.linkUserToDonation(donation.id, user2.id, time)).rejects.toThrowError(DonationUserLinkAlreadyExistsError)
    })
  })

  describe(nameof(DonationStore, 'unlinkUserFromDonation'), () => {
    test('Unlinks the user from the donation, returns the unlinked userId', async () => {
      const user = await db.chatUser.create({ data: {}})
      const donation1 = await createDonation({}, { userId: user.id, type: 'internal' })
      const donation2 = await createDonation({}, { userId: user.id, type: 'internal' })
      const donation3 = await createDonation({}, { userId: user.id, type: 'internal' })
      await expectRowCount(db.streamlabsUser).toBe(3)

      const userId = await donationStore.unlinkUserFromDonation(donation1.id)

      expect(userId).toBe(user.id)

      // should not have affected the user's links to other donations
      await expectRowCount(db.streamlabsUser).toBe(2)
    })

    test('Throws if no user is linked to the donation', async () => {
      const donation = await createDonation({})

      await expect(() => donationStore.unlinkUserFromDonation(donation.id)).rejects.toThrowError(DonationUserLinkNotFoundError)
    })
  })

  describe('DonationStore integration tests', () => {
    test('New donations with a streamlabsUserId that has already been linked in previously automatically inherit the link', async () => {
      const streamlabsUserId = 5
      const initialDonation: New<Donation> = {
        amount: 123,
        currency: 'AUD',
        formattedAmount: '123',
        name: 'Test user',
        streamlabsId: 1,
        time: new Date(),
        streamlabsUserId: streamlabsUserId
      }
      const secondDonation = {
        ...initialDonation,
        streamlabsId: 2
      }
      const otherDonation = {
        ...initialDonation,
        streamlabsUserId: streamlabsUserId + 1,
        streamlabsId: 3
      }

      const user1 = await db.chatUser.create({ data: {} })
      const user2 = await db.chatUser.create({ data: {} })
      const donation1 = await donationStore.addDonation(initialDonation)
      await donationStore.linkUserToDonation(donation1.id, user2.id, new Date())

      const donation2 = await donationStore.addDonation(secondDonation)
      await donationStore.addDonation(otherDonation) // other streamlabs user
      const result = await donationStore.getDonation(donation2.id)

      expect(result.userId).toBe(user2.id)

      const donationsByUser = await donationStore.getDonationsByUserId(2)
      expect(donationsByUser.length).toBe(2)
    })
  })

  async function createDonation (donationData: Partial<New<Donation>>, linkedUser?: { userId: number, type: 'streamlabs', streamlabsUser: number } | { userId: number, type: 'internal' }) {
    const donation = await db.donation.create({
      data: {
        amount: donationData.amount ?? 1,
        formattedAmount: `$${donationData.amount ?? 1}`,
        currency: donationData.currency ?? 'USD',
        name: donationData.name ?? 'Test name',
        streamlabsId: donationData.streamlabsId ?? randomInt(0, 100000000),
        streamlabsUserId: linkedUser?.type === 'streamlabs' ? linkedUser.streamlabsUser : donationData.streamlabsUserId,
        time: donationData.time ?? new Date(),
        message: donationData.message ?? null
      }
    })

    if (linkedUser != null) {
      try {
        await db.streamlabsUser.create({ data: {
          linkedUserId: linkedUser.userId,
          streamlabsUserId: linkedUser.type === 'streamlabs' ? `external-${linkedUser.streamlabsUser}` : `internal-${donation.id}`,
          linkedAt: new Date()
        }})
      } catch (e: any) {
        // errors are duplicate streamlabsUserIds
      }
    }

    return donation
  }
}
