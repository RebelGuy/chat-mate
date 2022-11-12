import { Donation } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { New } from '@rebel/server/models/entities'
import { Db } from '@rebel/server/providers/DbProvider'
import DonationStore, { DonationCreateArgs, DonationWithUser } from '@rebel/server/stores/DonationStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { expectArray, nameof } from '@rebel/server/_test/utils'
import * as data from '@rebel/server/_test/testData'
import { randomInt } from 'crypto'
import { DonationUserLinkAlreadyExistsError, DonationUserLinkNotFoundError } from '@rebel/server/util/error'
import { addTime } from '@rebel/server/util/datetime'
import { single } from '@rebel/server/util/arrays'
import { PartialCustomEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'

const streamer1 = 1
const streamer2 = 2

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
    test('Adds the donation with a message to the database', async () => {
      const part1: PartialTextChatMessage = { type: 'text', text: 'Part1', isBold: false, isItalics: false }
      const part2: PartialCustomEmojiChatMessage = {
        type: 'customEmoji',
        customEmojiId: 1,
        customEmojiVersion: 0,
        emoji: null,
        text: { type: 'text', text: 'Part2', isBold: false, isItalics: false }
      }
      const part3: PartialTextChatMessage = { type: 'text', text: 'Part3', isBold: false, isItalics: false }
      const donationData: DonationCreateArgs = {
        amount: 1.45,
        formattedAmount: '$1.45',
        currency: 'USD',
        name: 'Test name',
        streamlabsId: 123,
        time: data.time1,
        streamlabsUserId: null,
        messageParts: [part1, part2, part3]
      }
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1' }}}})
      await db.customEmoji.create({ data: {
        symbol: 'test',
        streamerId: streamer1,
        customEmojiVersions: { create: {
          image: Buffer.from(''),
          isActive: true,
          levelRequirement: 1,
          canUseInDonationMessage: true,
          name: 'name',
          version: 0
        }}
      }})

      await donationStore.addDonation(donationData)

      await expectRowCount(db.chatMessage, db.chatMessagePart, db.chatText, db.chatCustomEmoji, db.donation).toEqual([1, 3, 3, 1, 1])
    })

    test('Adds the donation without a message to the database', async () => {
      const donationData: DonationCreateArgs = {
        amount: 1.45,
        formattedAmount: '$1.45',
        currency: 'USD',
        name: 'Test name',
        streamlabsId: 123,
        time: data.time1,
        streamlabsUserId: null,
        messageParts: []
      }

      await donationStore.addDonation(donationData)

      await expectRowCount(db.chatMessage, db.chatMessagePart, db.chatText, db.chatCustomEmoji, db.donation).toEqual([0, 0, 0, 0, 1])
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

    test('Gets donation with message', async () => {
      await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1' }}}})
      const donation = await createDonation({})
      await db.chatText.create({ data: { isBold: false, isItalics: false, text: 'sample text' }})
      await db.chatCustomEmoji.create({ data: {
        text: { create: { isBold: false, isItalics: false, text: 'sample custom emoji' }},
        customEmojiVersion: { create: {
          image: Buffer.from(''),
          isActive: true,
          levelRequirement: 1,
          canUseInDonationMessage: true,
          name: 'name',
          version: 0,
          customEmoji: { create: { streamerId: streamer1, symbol: 'symbol' }}
        }}
      }})
      await db.chatMessage.create({ data: {
        externalId: '1',
        time: new Date(),
        donationId: donation.id,
        chatMessageParts: { createMany: { data: [{ order: 0, textId: 1 }, { order: 1, customEmojiId: 1 }]}}
      }})

      const result = await donationStore.getDonation(donation.id)

      expect(result.id).toBe(donation.id)
      expect(result.userId).toBe(null)
      expect(result.streamlabsUserId).toBe(null)
      expect(result.messageParts.length).toBe(2)
      expect(result.messageParts[0].text!.text).toBe('sample text')
      expect(result.messageParts[1].customEmoji!.customEmojiVersion.customEmoji.symbol).toBe('symbol')
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
      expect(result).toEqual(expectArray<DonationWithUser>([
        { ...donation3, linkIdentifier: 'internal-3', userId: null, linkedAt: null, messageParts: [] },
        { ...donation2, linkIdentifier: 'internal-2', userId: null, linkedAt: null, messageParts: [] }
      ]))
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

      const donationLinks = await db.donationLink.findMany({})
      expect(donationLinks.length).toBe(2)
      expect(donationLinks[0].linkedUserId).toBe(user.id)
      expect(donationLinks[0].linkIdentifier).toBe(`internal-${donation1.id}`)
      expect(donationLinks[1].linkedUserId).toBe(user.id)
      expect(donationLinks[1].linkIdentifier).toBe(`internal-${donation2.id}`)
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

      const donationLink = single(await db.donationLink.findMany({}))
      expect(donationLink.linkedUserId).toBe(user.id)
      expect(donationLink.linkIdentifier).toBe(`external-${streamlabsUserId}`)
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
      await expectRowCount(db.donationLink).toBe(3)

      const userId = await donationStore.unlinkUserFromDonation(donation1.id)

      expect(userId).toBe(user.id)

      // should not have affected the user's links to other donations
      await expectRowCount(db.donationLink).toBe(2)
    })

    test('Throws if no user is linked to the donation', async () => {
      const donation = await createDonation({})

      await expect(() => donationStore.unlinkUserFromDonation(donation.id)).rejects.toThrowError(DonationUserLinkNotFoundError)
    })
  })

  describe('DonationStore integration tests', () => {
    test('New donations with a streamlabsUserId that has already been linked in previously automatically inherit the link', async () => {
      const streamlabsUserId = 5
      const initialDonation: DonationCreateArgs = {
        amount: 123,
        currency: 'AUD',
        formattedAmount: '123',
        name: 'Test user',
        streamlabsId: 1,
        time: new Date(),
        streamlabsUserId: streamlabsUserId,
        messageParts: []
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
      await donationStore.addDonation(initialDonation)
      await donationStore.linkUserToDonation(1, user2.id, new Date())

      await donationStore.addDonation(secondDonation)
      await donationStore.addDonation(otherDonation) // other streamlabs user
      const result = await donationStore.getDonation(1)

      expect(result.userId).toBe(user2.id)

      const donationsByUser = await donationStore.getDonationsByUserId(2)
      expect(donationsByUser.length).toBe(2)
    })
  })

  /** Does not support message parts (I'm not re-implementing all that for a test) */
  async function createDonation (donationData: Partial<DonationCreateArgs>, linkedUser?: { userId: number, type: 'streamlabs', streamlabsUser: number } | { userId: number, type: 'internal' }) {
    const donation = await db.donation.create({
      data: {
        amount: donationData.amount ?? 1,
        formattedAmount: `$${donationData.amount ?? 1}`,
        currency: donationData.currency ?? 'USD',
        name: donationData.name ?? 'Test name',
        streamlabsId: donationData.streamlabsId ?? randomInt(0, 100000000),
        streamlabsUserId: linkedUser?.type === 'streamlabs' ? linkedUser.streamlabsUser : donationData.streamlabsUserId,
        time: donationData.time ?? new Date()
      }
    })

    if (linkedUser != null) {
      try {
        await db.donationLink.create({ data: {
          linkedUserId: linkedUser.userId,
          linkIdentifier: linkedUser.type === 'streamlabs' ? `external-${linkedUser.streamlabsUser}` : `internal-${donation.id}`,
          linkedAt: new Date()
        }})
      } catch (e: any) {
        // errors are duplicate linkIdentifiers
      }
    }

    return donation
  }
}
