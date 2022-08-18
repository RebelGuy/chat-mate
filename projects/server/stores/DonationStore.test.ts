import { Donation } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { New } from '@rebel/server/models/entities'
import { Db } from '@rebel/server/providers/DbProvider'
import DonationStore from '@rebel/server/stores/DonationStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb } from '@rebel/server/_test/db'
import { nameof } from '@rebel/server/_test/utils'
import * as data from '@rebel/server/_test/testData'
import { randomInt } from 'crypto'

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
        currency: 'USD',
        name: 'Test name',
        streamlabsId: 123,
        time: data.time1,
        linkedUserId: null,
        message: 'This is a test message'
      }

      const result = await donationStore.addDonation(donationData)

      expect(result).toEqual(expect.objectContaining(donationData))
    })
  })

  describe(nameof(DonationStore, 'getDonationsSince'), () => {
    test('Returns ordered donations after the given time', async () => {
      const donation1 = await createDonation({ time: data.time1 })
      const donation2 = await createDonation({ time: data.time3 })
      const donation3 = await createDonation({ time: data.time2 })

      const result = await donationStore.getDonationsSince(donation1.time)

      expect(result.length).toBe(2)
      expect(result).toEqual([donation3, donation2])
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
    test('Links specified user to the donation', async () => {
      const user = await db.chatUser.create({ data: {}})
      const donation = await createDonation()

      const result = await donationStore.linkUserToDonation(donation.id, user.id)

      expect(result.linkedUserId).toBe(user.id)
    })

    test('Overwrites existing user', async () => {
      const user1 = await db.chatUser.create({ data: {}})
      const user2 = await db.chatUser.create({ data: {}})
      const donation = await createDonation({ linkedUserId: user1.id })

      const result = await donationStore.linkUserToDonation(donation.id, user2.id)

      expect(result.linkedUserId).toBe(user2.id)
    })
    
    test('Throws if user not found', async () => {
      const donation = await createDonation()

      await expect(() => donationStore.linkUserToDonation(donation.id, 1)).rejects.toThrow()
    })

    test('Throws if donation not found', async () => {
      const user = await db.chatUser.create({ data: {}})

      await expect(() => donationStore.linkUserToDonation(1, user.id)).rejects.toThrow()
    })
  })

  async function createDonation (donationData?: Partial<New<Donation>>) {
    return await db.donation.create({
      data: {
        amount: donationData?.amount ?? 1,
        currency: donationData?.currency ?? 'USD',
        name: donationData?.name ?? 'Test name',
        streamlabsId: donationData?.streamlabsId ?? randomInt(0, 100000000),
        time: donationData?.time ?? new Date(),
        linkedUserId: donationData?.linkedUserId ?? null,
        message: donationData?.message ?? null
      }
    })
  }
}
