import { StreamlabsSocketToken } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import DonationStore, { DonationCreateArgs } from '@rebel/server/stores/DonationStore'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { expectArray, expectObject, nameof } from '@rebel/shared/testUtils'
import * as data from '@rebel/server/_test/testData'
import { ChatMateError, DbError, DonationUserLinkAlreadyExistsError, DonationUserLinkNotFoundError, NotFoundError } from '@rebel/shared/util/error'
import { addTime } from '@rebel/shared/util/datetime'
import { single } from '@rebel/shared/util/arrays'
import { PartialCustomEmojiChatMessage, PartialTextChatMessage } from '@rebel/server/models/chat'
import { DonationWithUser } from '@rebel/server/services/DonationService'

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

    await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1', aggregateChatUser: { create: {}} }}}})
    await db.streamer.create({ data: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2', aggregateChatUser: { create: {}} }}}})
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
        streamerId: streamer1,
        amount: 1.45,
        formattedAmount: '$1.45',
        currency: 'USD',
        name: 'Test name',
        streamlabsId: 123,
        time: data.time1,
        streamlabsUserId: null,
        messageParts: [part1, part2, part3]
      }
      await db.customEmoji.create({ data: {
        symbol: 'test',
        streamerId: streamer1,
        sortOrder: 1,
        customEmojiVersions: { create: {
          imageUrl: 'url',
          imageWidth: 100,
          imageHeight: 200,
          isActive: true,
          levelRequirement: 1,
          canUseInDonationMessage: true,
          name: 'name',
          version: 0
        }}
      }})

      const result = await donationStore.addDonation(donationData)

      expect(result).toBe(1)
      await expectRowCount(db.chatMessage, db.chatMessagePart, db.chatText, db.chatCustomEmoji, db.donation).toEqual([1, 3, 3, 1, 1])
    })

    test('Adds the donation without a message to the database', async () => {
      await db.donation.create({ data: {
        amount: 1,
        currency: 'AUD',
        formattedAmount: '1',
        name: 'Test',
        time: new Date(),
        streamerId: streamer1
      }})

      const donationData: DonationCreateArgs = {
        streamerId: streamer1,
        amount: 1.45,
        formattedAmount: '$1.45',
        currency: 'USD',
        name: 'Test name',
        streamlabsId: 123,
        time: data.time1,
        streamlabsUserId: null,
        messageParts: []
      }

      const result = await donationStore.addDonation(donationData)

      expect(result).toBe(2)
      await expectRowCount(db.chatMessage, db.chatMessagePart, db.chatText, db.chatCustomEmoji, db.donation).toEqual([0, 0, 0, 0, 2])
    })
  })

  describe(nameof(DonationStore, 'getDonation'), () => {
    test('Gets unlinked donation', async () => {
      const donation = await createDonation({})

      const result = await donationStore.getDonation(streamer1, donation.id)

      expect(result.id).toBe(donation.id)
      expect(result.streamlabsUserId).toBeNull()
      expect(result.primaryUserId).toBeNull()
      expect(result.streamerId).toBe(streamer1)
    })

    test('Gets donation with internal link', async () => {
      const user1 = await db.chatUser.create({ data: {} })
      const user2 = await db.chatUser.create({ data: {} })
      const donation = await createDonation({}, { userId: user2.id, type: 'internal' })

      const result = await donationStore.getDonation(streamer1, donation.id)

      expect(result.id).toBe(donation.id)
      expect(result.streamlabsUserId).toBeNull()
      expect(result.primaryUserId).toBe(user2.id)
      expect(result.streamerId).toBe(streamer1)
    })

    test('Gets donation with external link', async () => {
      const user1 = await db.chatUser.create({ data: {} })
      const user2 = await db.chatUser.create({ data: {} })
      const donation = await createDonation({}, { userId: user2.id, type: 'streamlabs', streamlabsUser: 5 })

      const result = await donationStore.getDonation(streamer1, donation.id)

      expect(result.id).toBe(donation.id)
      expect(result.streamlabsUserId).toBe(5)
      expect(result.primaryUserId).toBe(user2.id)
      expect(result.streamerId).toBe(streamer1)
    })

    test('Gets donation with message', async () => {
      const donation = await createDonation({})
      await db.chatText.create({ data: { isBold: false, isItalics: false, text: 'sample text' }})
      await db.chatCustomEmoji.create({ data: {
        text: { create: { isBold: false, isItalics: false, text: 'sample custom emoji' }},
        customEmojiVersion: { create: {
          imageUrl: 'url',
          imageWidth: 100,
          imageHeight: 200,
          isActive: true,
          levelRequirement: 1,
          canUseInDonationMessage: true,
          name: 'name',
          version: 0,
          customEmoji: { create: { streamerId: streamer1, symbol: 'symbol', sortOrder: 1 }}
        }}
      }})
      await db.chatMessage.create({ data: {
        externalId: '1',
        streamerId: streamer1,
        time: new Date(),
        donationId: donation.id,
        chatMessageParts: { createMany: { data: [{ order: 0, textId: 1 }, { order: 1, customEmojiId: 1 }]}}
      }})

      const result = await donationStore.getDonation(streamer1, donation.id)

      expect(result.id).toBe(donation.id)
      expect(result.streamerId).toBe(streamer1)
      expect(result.primaryUserId).toBe(null)
      expect(result.streamlabsUserId).toBe(null)
      expect(result.messageParts.length).toBe(2)
      expect(result.messageParts[0].text!.text).toBe('sample text')
      expect(result.messageParts[1].customEmoji!.customEmojiVersion.customEmoji.symbol).toBe('symbol')
    })

    test('Does not attach the user linked by another streamer', async () => {
      const streamlabsUserId = 5
      const user = await db.chatUser.create({ data: {} })
      const donation1 = await createDonation({ streamerId: streamer1, streamlabsUserId })
      const donation2 = await createDonation({ streamerId: streamer2, streamlabsUserId }, { type: 'streamlabs', streamlabsUser: streamlabsUserId, userId: user.id })

      const result = await donationStore.getDonation(streamer1, donation1.id)
      expect(result.primaryUserId).toBeNull()
      expect(result.linkedAt).toBeNull()
    })

    test(`Throws if donation doesn't exist`, async () => {
      await expect(() => donationStore.getDonation(streamer1, 5)).rejects.toThrowError(DbError)
    })

    test('Throws if donation is deleted', async () => {
      const user = await db.chatUser.create({ data: {}})
      const donation = await createDonation({ isDeleted: true }, { userId: user.id, type: 'internal' })

      await expect(() => donationStore.getDonation(streamer1, donation.id)).rejects.toThrowError(DbError)
    })

    test('Throws if donation is inaccessible', async () => {
      const user = await db.chatUser.create({ data: {}})
      const donation = await createDonation({ streamerId: streamer2 }, { userId: user.id, type: 'internal' })

      await expect(() => donationStore.getDonation(streamer1, donation.id)).rejects.toThrowError(DbError)
    })
  })

  describe(nameof(DonationStore, 'deleteDonation'), () => {
    test('Marks the donation as deleted', async () => {
      const user = await db.chatUser.create({ data: {}})
      const donation = await createDonation({}, { userId: user.id, type: 'internal' })

      await donationStore.deleteDonation(streamer1, donation.id)

      const storedDonation = await db.donation.findUnique({ where: { id: donation.id } })
      expect(storedDonation!.deletedAt).not.toBe(null)
    })

    test('Throws if the donation is already deleted', async () => {
      const user = await db.chatUser.create({ data: {}})
      const donation = await createDonation({ isDeleted: true }, { userId: user.id, type: 'internal' })

      await expect(() => donationStore.deleteDonation(streamer1, donation.id)).rejects.toThrowError(ChatMateError)
    })

    test('Throws if donation is inaccessible', async () => {
      const user = await db.chatUser.create({ data: {}})
      const donation = await createDonation({ isDeleted: true, streamerId: streamer2 }, { userId: user.id, type: 'internal' })

      await expect(() => donationStore.deleteDonation(streamer1, donation.id)).rejects.toThrowError(ChatMateError)
    })
  })

  describe(nameof(DonationStore, 'getDonationsByUserIds'), () => {
    test('Returns ordered donations linked to the given users', async () => {
      const user1 = await db.chatUser.create({ data: {} })
      const user2 = await db.chatUser.create({ data: {} })
      const user3 = await db.chatUser.create({ data: {} })
      const donation1 = await createDonation({ time: data.time1, streamerId: streamer1 }, { userId: user2.id, type: 'internal' })
      const donation2 = await createDonation({ time: data.time2, streamerId: streamer1 }, { userId: user1.id, type: 'internal' }) // 2
      const donation3 = await createDonation({ time: data.time2, streamerId: streamer2 }, { userId: user1.id, type: 'internal' }) // wrong streamer
      const donation4 = await createDonation({ time: data.time1, streamerId: streamer1 }, { userId: user1.id, type: 'streamlabs', streamlabsUser: 1 }) // 1
      const donation5 = await createDonation({ time: data.time2, streamerId: streamer1 }, { userId: user2.id, type: 'streamlabs', streamlabsUser: 3 })
      const donation6 = await createDonation({ time: data.time3, streamerId: streamer1 }, { userId: user3.id, type: 'streamlabs', streamlabsUser: 2 }) // 3
      const donation7 = await createDonation({ time: data.time3, streamerId: streamer2 }, { userId: user3.id, type: 'streamlabs', streamlabsUser: 2 }) // wrong streamer
      const donation8 = await createDonation({ time: data.time2, streamerId: streamer1 }, { userId: user2.id, type: 'streamlabs', streamlabsUser: 3 })
      const donation9 = await createDonation({ time: addTime(data.time3, 'seconds', 1) })

      const result = await donationStore.getDonationsByUserIds(streamer1, [user1.id, user3.id], false)

      expect(result.length).toBe(3)
      expect(result).toEqual([donation4, donation2, donation6])
    })

    test('Does not include donations for a user that was linked by another streamer', async () => {
      const streamlabsUserId = 5
      const user = await db.chatUser.create({ data: {} })
      const donation1 = await createDonation({ streamerId: streamer1, streamlabsUserId })
      const donation2 = await createDonation({ streamerId: streamer2, streamlabsUserId }, { type: 'streamlabs', streamlabsUser: streamlabsUserId, userId: user.id })

      const result = await donationStore.getDonationsByUserIds(streamer1, [user.id], false)

      expect(result.length).toBe(0)
    })

    test('Includes refunded donations only if the `includeRefunded` flag is true', async () => {
      const user = await db.chatUser.create({ data: {} })
      await createDonation({ time: data.time2, streamerId: streamer1, isRefunded: true }, { userId: user.id, type: 'internal' })
      await createDonation({ time: data.time2, streamerId: streamer1, isRefunded: false }, { userId: user.id, type: 'internal' })

      const result1 = await donationStore.getDonationsByUserIds(streamer1, [user.id], false)
      const result2 = await donationStore.getDonationsByUserIds(streamer1, [user.id], true)

      expect(result1.length).toBe(1)
      expect(result2.length).toBe(2)
    })

    test('Does not include deleted donations', async () => {
      const user = await db.chatUser.create({ data: {} })
      await createDonation({ time: data.time2, streamerId: streamer1, isDeleted: true }, { userId: user.id, type: 'internal' })

      const result = await donationStore.getDonationsByUserIds(streamer1, [user.id], false)

      expect(result.length).toBe(0)
    })
  })

  describe(nameof(DonationStore, 'getDonationsSince'), () => {
    test('Returns ordered donations for the streamer after the given time', async () => {
      const donation1 = await createDonation({ time: data.time1 })
      const donation2 = await createDonation({ time: data.time3 })
      const donation3 = await createDonation({ time: data.time2 })
      const donation4 = await createDonation({ time: data.time2, streamerId: streamer2 })

      const result = await donationStore.getDonationsSince(streamer1, donation1.time.getTime(), false)

      expect(result.length).toBe(2)
      expect(result).toEqual(expectArray<DonationWithUser>([
        { ...donation3, linkIdentifier: 'internal-3', primaryUserId: null, linkedAt: null, messageParts: [] },
        { ...donation2, linkIdentifier: 'internal-2', primaryUserId: null, linkedAt: null, messageParts: [] }
      ]))
    })

    test('Does not attach the user linked by another streamer', async () => {
      const streamlabsUserId = 5
      const user = await db.chatUser.create({ data: {} })
      const donation1 = await createDonation({ streamerId: streamer1, streamlabsUserId })
      const donation2 = await createDonation({ streamerId: streamer2, streamlabsUserId }, { type: 'streamlabs', streamlabsUser: streamlabsUserId, userId: user.id })

      const result = await donationStore.getDonationsSince(streamer1, 0, false)

      expect(result.length).toBe(1)
      expect(result[0].primaryUserId).toBeNull()
      expect(result[0].linkedAt).toBeNull()
    })

    test('Includes refunded donations only if the `includeRefunded` flag is true', async () => {
      const user = await db.chatUser.create({ data: {} })
      await createDonation({ time: data.time2, streamerId: streamer1, isRefunded: true }, { userId: user.id, type: 'internal' })
      await createDonation({ time: data.time2, streamerId: streamer1, isRefunded: false }, { userId: user.id, type: 'internal' })

      const result1 = await donationStore.getDonationsSince(streamer1, data.time1.getTime(), false)
      const result2 = await donationStore.getDonationsSince(streamer1, data.time1.getTime(), true)

      expect(result1.length).toBe(1)
      expect(result2.length).toBe(2)
    })

    test('Does not include deleted donations', async () => {
      const user = await db.chatUser.create({ data: {} })
      const donation = await createDonation({ time: data.time2, streamerId: streamer1, isDeleted: true }, { userId: user.id, type: 'internal' })

      const result = await donationStore.getDonationsSince(streamer1, donation.time.getTime(), false)

      expect(result.length).toBe(0)
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

  describe(nameof(DonationStore, 'getStreamlabsSocketToken'), () => {
    test('Returns the token for the given streamer', async () => {
      await db.streamlabsSocketToken.createMany({ data: [
        { token: 'test1', streamerId: streamer1 },
        { token: 'test2', streamerId: streamer2 }
      ]})

      const result = await donationStore.getStreamlabsSocketToken(streamer2)

      expect(result!.token).toBe('test2')
    })

    test('Returns null if no token exists for the given streamer', async () => {
      await db.streamlabsSocketToken.create({ data: { token: 'test2', streamerId: streamer2 }})

      const result = await donationStore.getStreamlabsSocketToken(streamer1)

      expect(result).toBeNull()
    })
  })

  describe(nameof(DonationStore, 'linkUserToDonation'), () => {
    test('Links specified user to the donations (no streamlabs user)', async () => {
      const user = await db.chatUser.create({ data: {}})
      const donation1 = await createDonation({})
      const donation2 = await createDonation({})
      const time = new Date()

      await donationStore.linkUserToDonation(streamer1, donation1.id, user.id, time)
      await donationStore.linkUserToDonation(streamer1, donation2.id, user.id, time)

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
      const donation3 = await createDonation({ streamlabsUserId, streamerId: streamer2 })
      const time = new Date()

      await donationStore.linkUserToDonation(streamer1, donation1.id, user.id, time)

      // make sure we can't create the same link twice (even by referencing different donations)
      let secondHasFailed = false
      try {
        await donationStore.linkUserToDonation(streamer1, donation2.id, user.id, time)
      } catch (e) {
        if (e instanceof DonationUserLinkAlreadyExistsError) {
          secondHasFailed = true
        }
      }

      const donationLink = single(await db.donationLink.findMany({}))
      expect(donationLink.linkedUserId).toBe(user.id)
      expect(donationLink.linkIdentifier).toBe(`external-${streamlabsUserId}`)
      expect(donationLink.streamerId).toBe(streamer1)
      expect(secondHasFailed).toBe(true)

      // make sure another streamer can link the same streamlabs user to another chatmate user
      await donationStore.linkUserToDonation(streamer2, donation3.id, user.id, time)

      const otherDonationLink = await db.donationLink.findMany({}).then(link => link[1])
      expect(otherDonationLink.linkedUserId).toBe(user.id)
      expect(otherDonationLink.linkIdentifier).toBe(`external-${streamlabsUserId}`)
      expect(otherDonationLink.streamerId).toBe(streamer2)
    })

    test('Throws if a user is already linked (no streamlabs user)', async () => {
      const user1 = await db.chatUser.create({ data: {}})
      const user2 = await db.chatUser.create({ data: {}})
      const donation = await createDonation({}, { userId: user1.id, type: 'internal' })
      const time = new Date()

      await expect(() => donationStore.linkUserToDonation(streamer1, donation.id, user2.id, time)).rejects.toThrowError(DonationUserLinkAlreadyExistsError)
    })

    test('Throws if trying to link to a deleted donation', async () => {
      const user = await db.chatUser.create({ data: {}})
      const donation = await createDonation({ isDeleted: true })
      const time = new Date()

      await expect(() => donationStore.linkUserToDonation(streamer1, donation.id, user.id, time)).rejects.toThrowError(NotFoundError)
    })

    test('Throws if trying to link to a donation from another streamer', async () => {
      const user = await db.chatUser.create({ data: {}})
      const donation = await createDonation({ streamerId: streamer2 })
      const time = new Date()

      await expect(() => donationStore.linkUserToDonation(streamer1, donation.id, user.id, time)).rejects.toThrowError(NotFoundError)
    })
  })

  describe(nameof(DonationStore, 'refundDonation'), () => {
    test('Marks the donation as refunded', async () => {
      const donation = await createDonation({})

      await donationStore.refundDonation(streamer1,   donation.id)

      const storedDonation = await db.donation.findUnique({ where: { id: donation.id } })
      expect(storedDonation!.refundedAt).not.toBe(null)
    })

    test('Throws if the donation is already refunded', async () => {
      const donation = await createDonation({ isRefunded: true })

      await expect(() => donationStore.refundDonation(streamer1, donation.id)).rejects.toThrowError(ChatMateError)
    })

    test('Throws if the donation is deleted', async () => {
      const donation = await createDonation({ isDeleted: true })

      await expect(() => donationStore.refundDonation(streamer1, donation.id)).rejects.toThrowError(ChatMateError)
    })

    test('Throws if the donation is from another streamer', async () => {
      const donation = await createDonation({ streamerId: streamer2 })

      await expect(() => donationStore.refundDonation(streamer1, donation.id)).rejects.toThrowError(ChatMateError)
    })
  })

  describe(nameof(DonationStore, 'relinkDonation'), () => {
    test('Updates all donation links of the given user', async () => {
      const user1 = await db.chatUser.create({ data: {}})
      const user2 = await db.chatUser.create({ data: {}})
      const user3 = await db.chatUser.create({ data: {}})
      await createDonation({}, { userId: user1.id, type: 'internal' })
      await createDonation({}, { userId: user1.id, type: 'internal' })
      await createDonation({}, { userId: user2.id, type: 'internal' })

      await donationStore.relinkDonation(user1.id, user3.id)

      const stored = await db.donationLink.findMany({})
      expect(stored).toEqual(expectObject(stored, [
        { linkedUserId: user3.id, originalLinkedUserId: user1.id },
        { linkedUserId: user3.id, originalLinkedUserId: user1.id },
        { linkedUserId: user2.id, originalLinkedUserId: null }
      ]))
    })
  })

  describe(nameof(DonationStore, 'setStreamlabsSocketToken'), () => {
    const streamer1Token = 'streamer1Token'
    const streamer2Token = 'streamer2Token'

    beforeEach(async () => {
      // streamer 2 already has a token, streamer 1 does not
      await db.streamlabsSocketToken.create({ data: { streamerId: streamer2, token: streamer2Token }})
    })

    test('Makes no change and returns false when setting the same token that already exists in the db', async () => {
      const result = await donationStore.setStreamlabsSocketToken(streamer2, streamer2Token)

      expect(result).toBe(false)
      await expectRowCount(db.streamlabsSocketToken).toBe(1)
    })

    test('Creates the token for the streamer and returns true', async () => {
      const result = await donationStore.setStreamlabsSocketToken(streamer1, streamer1Token)

      expect(result).toBe(true)
      await expectRowCount(db.streamlabsSocketToken).toBe(2)
      const store = await db.streamlabsSocketToken.findFirst({ where: { streamerId: streamer1 }})
      expect(store).toEqual(expectObject<StreamlabsSocketToken>({ streamerId: streamer1, token: streamer1Token }))
    })

    test('Throws if there is an existing token', async () => {
      const updatedToken = 'streame2UpdatedToken'

      await expect(() => donationStore.setStreamlabsSocketToken(streamer2, updatedToken)).rejects.toThrowError(ChatMateError)
    })

    test('Makes no change and returns false when removing the token when none exists in the db', async () => {
      const result = await donationStore.setStreamlabsSocketToken(streamer1, null)

      expect(result).toBe(false)
      await expectRowCount(db.streamlabsSocketToken).toBe(1)
    })

    test('Removes the existing token of the streamer and returns true', async () => {
      const result = await donationStore.setStreamlabsSocketToken(streamer2, null)

      expect(result).toBe(true)
      await expectRowCount(db.streamlabsSocketToken).toBe(0)
    })
  })

  describe(nameof(DonationStore, 'undoDonationRelink'), () => {
    test('Updates all donation links of the given user', async () => {
      const user1 = await db.chatUser.create({ data: {}})
      const user2 = await db.chatUser.create({ data: {}})
      const user3 = await db.chatUser.create({ data: {}})
      await createDonation({}, { userId: user1.id, type: 'internal' })
      await createDonation({}, { userId: user1.id, type: 'internal' })
      await createDonation({}, { userId: user2.id, type: 'internal' })

      await donationStore.relinkDonation(user1.id, user3.id)

      await donationStore.undoDonationRelink(user1.id)

      const stored = await db.donationLink.findMany({})
      expect(stored).toEqual(expectObject(stored, [
        { linkedUserId: user1.id, originalLinkedUserId: null },
        { linkedUserId: user1.id, originalLinkedUserId: null },
        { linkedUserId: user2.id, originalLinkedUserId: null }
      ]))
    })
  })

  describe(nameof(DonationStore, 'unlinkUserFromDonation'), () => {
    test('Unlinks the user from the donation, returns the unlinked userId', async () => {
      const user = await db.chatUser.create({ data: {}})
      const donation1 = await createDonation({}, { userId: user.id, type: 'internal' })
      const donation2 = await createDonation({}, { userId: user.id, type: 'internal' })
      const donation3 = await createDonation({}, { userId: user.id, type: 'internal' })
      await expectRowCount(db.donationLink).toBe(3)

      const userId = await donationStore.unlinkUserFromDonation(streamer1, donation1.id)

      expect(userId).toBe(user.id)

      // should not have affected the user's links to other donations
      await expectRowCount(db.donationLink).toBe(2)
    })

    test('Does not affect the link set by another streamer', async () => {
      const streamlabsId = 1925
      const user = await db.chatUser.create({ data: {}})
      const donation1 = await createDonation({ streamerId: streamer1 }, { userId: user.id, type: 'streamlabs', streamlabsUser: streamlabsId })
      const donation2 = await createDonation({ streamerId: streamer2 }, { userId: user.id, type: 'streamlabs', streamlabsUser: streamlabsId })
      await expectRowCount(db.donationLink).toBe(2)

      const userId = await donationStore.unlinkUserFromDonation(streamer1, donation1.id)

      expect(userId).toBe(user.id)

      // should not have affected the user's links to other streamer's donations
      const remainingLink = await db.donationLink.findMany({}).then(single)
      expect(remainingLink.streamerId).toBe(streamer2)
      expect(remainingLink.linkedUserId).toBe(user.id)
    })

    test('Throws if no user is linked to the donation', async () => {
      const donation = await createDonation({})

      await expect(() => donationStore.unlinkUserFromDonation(streamer1, donation.id)).rejects.toThrowError(DonationUserLinkNotFoundError)
    })

    test('Throws if trying to unlink from a deleted donation', async () => {
      const user = await db.chatUser.create({ data: {}})
      const donation = await createDonation({ isDeleted: true }, { userId: user.id, type: 'internal' })

      await expect(() => donationStore.unlinkUserFromDonation(streamer1, donation.id)).rejects.toThrowError(NotFoundError)
    })

    test('Throws if trying to unlink from a donation from another streamer', async () => {
      const user = await db.chatUser.create({ data: {}})
      const donation = await createDonation({ streamerId: streamer2 }, { userId: user.id, type: 'internal' })

      await expect(() => donationStore.unlinkUserFromDonation(streamer1, donation.id)).rejects.toThrowError(NotFoundError)
    })
  })

  describe('DonationStore integration tests', () => {
    test('New donations with a streamlabsUserId that has already been linked in previously automatically inherit the link, even across different streamers', async () => {
      const streamlabsUserId = 5
      const initialDonation: DonationCreateArgs = {
        streamerId: streamer1,
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
      await donationStore.linkUserToDonation(streamer1, 1, user2.id, new Date())

      await donationStore.addDonation(secondDonation)
      await donationStore.addDonation(otherDonation) // other streamlabs user
      const result = await donationStore.getDonation(streamer1, 1)

      expect(result.primaryUserId).toBe(user2.id)

      const donationsByUser = await donationStore.getDonationsByUserIds(streamer1, [user2.id], false)
      expect(donationsByUser.length).toBe(2)
    })
  })

  /** Does not support message parts (I'm not re-implementing all that for a test) */
  async function createDonation (donationData: Partial<DonationCreateArgs & { isRefunded: boolean, isDeleted: boolean }>, linkedUser?: { userId: number, type: 'streamlabs', streamlabsUser: number } | { userId: number, type: 'internal' }) {
    const donation = await db.donation.create({
      data: {
        streamerId: donationData.streamerId ?? streamer1,
        amount: donationData.amount ?? 1,
        formattedAmount: `$${donationData.amount ?? 1}`,
        currency: donationData.currency ?? 'USD',
        name: donationData.name ?? 'Test name',
        streamlabsId: donationData.streamlabsId ?? null,
        streamlabsUserId: linkedUser?.type === 'streamlabs' ? linkedUser.streamlabsUser : donationData.streamlabsUserId,
        time: donationData.time ?? new Date(),
        refundedAt: donationData.isRefunded ? new Date() : undefined,
        deletedAt: donationData.isDeleted ? new Date() : undefined
      }
    })

    if (linkedUser != null) {
      try {
        await db.donationLink.create({ data: {
          streamerId: donationData.streamerId ?? streamer1,
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
