import { ChatMessage } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import ExperienceStore, { UserExperience } from '@rebel/server/stores/ExperienceStore'
import { DB_TEST_TIMEOUT, expectRowCount, startTestDb, stopTestDb } from '@rebel/server/_test/db'
import { deleteProps, nameof } from '@rebel/server/_test/utils'
import { single } from '@rebel/server/util/arrays'
import { mock, MockProxy } from 'jest-mock-extended'
import * as data from '@rebel/server/_test/testData'
import AdminService from '@rebel/server/services/rank/AdminService'
import { addTime } from '@rebel/server/util/datetime'

// these are some good unit tests!
export default () => {
  const chatExperienceData1 = deleteProps(data.chatExperienceData1, 'externalId')
  const chatExperienceData2 = deleteProps(data.chatExperienceData2, 'externalId')
  const chatExperienceData3 = deleteProps(data.chatExperienceData3, 'externalId')
  const user1 = 1
  const user2 = 2
  const user3 = 3
  const user4 = 4
  const streamer1 = 1
  const streamer2 = 2

  /** time 1, channel 1 */
  let chatMessage1: ChatMessage
  /** time 2, channel 1 */
  let chatMessage2: ChatMessage
  /** time 3, channel 2 */
  let chatMessage3: ChatMessage

  let mockAdminService: MockProxy<AdminService>
  let experienceStore: ExperienceStore
  let db: Db
  beforeEach(async () => {
    const dbProvider = await startTestDb()
    mockAdminService = mock()

    experienceStore = new ExperienceStore(new Dependencies({
      dbProvider,
      adminService: mockAdminService
    }))
    db = dbProvider.get()

    await db.chatUser.createMany({ data: [{}, {}, {}, {}]})

    const channelId1 = 1
    const channelId2 = 2
    await db.youtubeChannel.createMany({ data: [{ userId: user1, youtubeId: data.youtubeChannel1 }, { userId: user2, youtubeId: data.youtubeChannel2}] })
    await db.streamer.create({ data: { registeredUser: { create: { username: 'user1', hashedPassword: 'pass1' }}}})
    await db.streamer.create({ data: { registeredUser: { create: { username: 'user2', hashedPassword: 'pass2' }}}})

    chatMessage1 = await data.addChatMessage(db, data.time1, null, user1, channelId1)
    chatMessage2 = await data.addChatMessage(db, data.time2, null, user1, channelId1)
    chatMessage3 = await data.addChatMessage(db, data.time3, null, user2, channelId2)

    await experienceStore.initialise()
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(ExperienceStore, 'addChatExperience'), () => {
    test('adds transaction with correct chat experience data', async () => {
      const data1 = { ...chatExperienceData1, externalId: chatMessage1.externalId }

      await experienceStore.addChatExperience(streamer1, user1, data.time1.getTime(), 10, data1)

      const added = (await db.experienceTransaction.findFirst({ include: {
        experienceDataChatMessage: { include: { chatMessage: true }},
        user: true
      }}))!
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      delete (data1 as any).externalId // hehe <:
      expect(added.streamerId).toBe(streamer1)
      expect(added.delta).toBe(10)
      expect(added.time).toEqual(data.time1)
      expect(added.userId).toBe(user1)
      expect(added.experienceDataChatMessage).toEqual(expect.objectContaining(data1))
      expect(added.experienceDataChatMessage!.chatMessage!.externalId).toBe(chatMessage1.externalId)
    })

    test('does not add data if trying to backfill or duplicate', async () => {
      await db.experienceTransaction.create({ data: {
        streamerId: streamer1,
        userId: user1,
        delta: 100,
        time: chatMessage2.time,
        experienceDataChatMessage: { create: {
          ...chatExperienceData2,
          chatMessage: { connect: { externalId: chatMessage2.externalId }}
        }}
      }})

      await experienceStore.addChatExperience(streamer1, user1, chatMessage1.time.getTime(), 20, { ...data.chatExperienceData1, externalId: chatMessage1.externalId })
      await experienceStore.addChatExperience(streamer1, user1, chatMessage2.time.getTime(), 30, { ...data.chatExperienceData2, externalId: chatMessage2.externalId })

      await expectRowCount(db.experienceTransaction).toBe(1)
    })

    test('Backfill/duplication rule is isolated per streamer', async () => {
      await db.experienceTransaction.create({ data: {
        streamerId: streamer2,
        userId: user1,
        delta: 100,
        time: chatMessage2.time,
        experienceDataChatMessage: { create: {
          ...chatExperienceData2,
          chatMessage: { connect: { externalId: chatMessage2.externalId }}
        }}
      }})

      await experienceStore.addChatExperience(streamer1, user1, chatMessage1.time.getTime(), 20, { ...data.chatExperienceData1, externalId: chatMessage1.externalId })
      await experienceStore.addChatExperience(streamer1, user1, chatMessage2.time.getTime(), 30, { ...data.chatExperienceData3, externalId: chatMessage3.externalId })

      await expectRowCount(db.experienceTransaction).toBe(3)
    })
  })

  describe(nameof(ExperienceStore, 'addManualExperience'), () => {
    test('correctly adds experience', async () => {
      const admin1 = 3
      const admin2 = 4
      const streamerId = 2
      mockAdminService.getAdminUsers.calledWith(streamerId).mockResolvedValue([{ id: admin1 }, { id: admin2 }])

      await experienceStore.addManualExperience(streamerId, user1, -200, 'This is a test')

      const added = (await db.experienceTransaction.findFirst({ include: {
        experienceDataAdmin: true,
        user: true
      }}))!
      expect(added.streamerId).toBe(streamerId)
      expect(added.userId).toBe(user1)
      expect(added.delta).toBe(-200)
      expect(added.experienceDataAdmin?.adminUserId).toBe(admin1)
      expect(added.experienceDataAdmin?.message).toBe('This is a test')
    })
  })

  describe(nameof(ExperienceStore, 'getExperience'), () => {
    test('returns 0 if user has no experience data for the specified streamer streamer', async () => {
      await db.experienceTransaction.create({ data: {
        streamerId: streamer2, // different streamer
        userId: user1,
        time: data.time1,
        delta: 100
      }})

      const result = await experienceStore.getExperience(streamer1, [user1])

      expect(single(result)).toEqual(expect.objectContaining<UserExperience>({
        userId: user1,
        experience: 0
      }))
    })

    test('returns the snapshot value if there are no later experience transactions', async () => {
      const xp = 1000
      await db.experienceSnapshot.createMany({ data: [
        { streamerId: streamer1, userId: user1, experience: xp, time: data.time2 },
        { streamerId: streamer2, userId: user1, experience: xp * 2, time: data.time2 }, // different streamer
        { streamerId: streamer2, userId: user1, experience: xp * 3, time: data.time3 } // different streamer
      ]})

      const result = await experienceStore.getExperience(streamer1, [user1])

      expect(single(result)).toEqual(expect.objectContaining<UserExperience>({
        userId: user1,
        experience: xp
      }))
    })

    test('returns the sum of the deltas if there is no snapshot', async () => {
      const xp1 = 100
      const xp2 = 200
      const xp3 = 500
      await db.experienceTransaction.createMany({ data: [
        { streamerId: streamer1, userId: user1, delta: xp1, time: data.time1 },
        { streamerId: streamer1, userId: user1, delta: xp2, time: data.time1 },
        { streamerId: streamer1, userId: user1, delta: xp3, time: data.time1 },
        { streamerId: streamer2, userId: user1, delta: xp3, time: data.time1 } // different streamer
      ]})

      const result = await experienceStore.getExperience(streamer1, [user1])

      expect(single(result)).toEqual(expect.objectContaining<UserExperience>({
        userId: user1,
        experience: xp1 + xp2 + xp3
      }))
    })

    test('returns the snapshot plus the sum of the deltas of transactions coming after the snapshot', async () => {
      const xp1 = 100
      const xp2 = 200
      const xp3 = 500
      const xpSnap = 1000
      await db.experienceTransaction.createMany({ data: [
        { streamerId: streamer1, userId: user1, delta: xp1, time: data.time2 }, // same time as snapshot
        { streamerId: streamer1, userId: user1, delta: xp2, time: data.time3 },
        { streamerId: streamer1, userId: user1, delta: xp3, time: data.time3 },
        { streamerId: streamer2, userId: user1, delta: xp3 * 2, time: data.time3 } // different streamer
      ]})
      await db.experienceSnapshot.createMany({ data: [
        { streamerId: streamer1, userId: user1, experience: xpSnap, time: data.time2 },
        { streamerId: streamer2, userId: user1, experience: xpSnap * 2, time: addTime(data.time2, 'seconds', 1) } // different streamer
      ]})

      const result = await experienceStore.getExperience(streamer1, [user1])

      expect(single(result)).toEqual(expect.objectContaining<UserExperience>({
        userId: user1,
        experience: xpSnap + xp2 + xp3
      }))
    })

    test('returns information for multiple users', async () => {
      await db.experienceTransaction.createMany({ data: [
        { streamerId: streamer1, userId: user2, delta: 10, time: data.time1 },
        { streamerId: streamer1, userId: user2, delta: 11, time: data.time3 },
        { streamerId: streamer1, userId: user3, delta: 10, time: data.time1 },
        { streamerId: streamer1, userId: user3, delta: 20, time: data.time2 },
        { streamerId: streamer1, userId: user3, delta: 30, time: data.time3 },
        { streamerId: streamer2, userId: user4, delta: 10, time: data.time1 }, // different streamer
        { streamerId: streamer2, userId: user2, delta: 11, time: data.time3 }, // different streamer
        { streamerId: streamer2, userId: user3, delta: 10, time: data.time1 } // different streamer
      ]})
      await db.experienceSnapshot.createMany({ data: [
        { streamerId: streamer1, userId: user1, experience: 100, time: data.time2 },
        { streamerId: streamer1, userId: user2, experience: 200, time: data.time2 },
        { streamerId: streamer2, userId: user2, experience: 2000, time: data.time2 }, // different streamer
        { streamerId: streamer2, userId: user4, experience: 3000, time: data.time2 } // different streamer
      ]})

      const result = await experienceStore.getExperience(streamer1, [1, 2, 3, 4])

      expect(result).toEqual(expect.arrayContaining<UserExperience>([
        { userId: 1, experience: 100 },
        { userId: 2, experience: 200 + 11 },
        { userId: 3, experience: 10 + 20 + 30 },
        { userId: 4, experience: 0}
      ]))
    })

    test('returns empty array if the provided array of user ids is empty', async () => {
      const result = await experienceStore.getExperience(streamer1, [])

      expect(result.length).toBe(0)
    })
  })

  describe(nameof(ExperienceStore, 'getSnapshot'), () => {
    test('returns null if no snapshot exists', async () => {
      await db.experienceSnapshot.createMany({ data: [{
        streamerId: streamer1,
        userId: user2, // different user
        experience: 10,
        time: data.time1
      }, {
        streamerId: streamer2, // different streamer
        userId: user1,
        experience: 10,
        time: data.time1
      }]})

      const result = await experienceStore.getSnapshot(streamer1, user1)

      expect(result).toBeNull()
    })

    test('gets correct snapshot', async () => {
      await db.experienceSnapshot.createMany({ data: [{
        streamerId: streamer1,
        userId: user1,
        experience: 10,
        time: data.time1
      }, {
        streamerId: streamer1,
        userId: user1,
        experience: 20,
        time: data.time2
      }]})


      const result = await experienceStore.getSnapshot(streamer1, user1)

      expect(result!.experience).toEqual(20)
      expect(result!.time).toEqual(data.time2)
    })
  })

  describe(nameof(ExperienceStore, 'getPreviousChatExperience'), () => {
    test('returns null if no transaction with chat data exists', async () => {
      await db.experienceTransaction.createMany({ data: [{
        streamerId: streamer1,
        userId: user1,
        delta: 10,
        time: data.time1
        // no chat message data
      }, {
        streamerId: streamer2, // different streamer
        userId: user1,
        delta: 10,
        time: data.time1
      }]})
      await db.experienceTransaction.create({ data: {
        streamerId: streamer1,
        userId: user2, // different user
        delta: 10,
        time: data.time3,
        experienceDataChatMessage: { create: {
          ...chatExperienceData3,
          chatMessage: { connect: { externalId: chatMessage3.externalId }}
        }}
      }})

      const result = await experienceStore.getPreviousChatExperience(streamer1, user1)

      expect(result).toBeNull()
    })

    test('gets correct data', async () => {
      await db.experienceTransaction.create({ data: {
        streamerId: streamer1,
        userId: user1,
        delta: 10,
        time: data.time1,
        experienceDataChatMessage: { create: {
          ...chatExperienceData1,
          chatMessage: { connect: { externalId: chatMessage1.externalId }}
        }}
      }})
      await db.experienceTransaction.create({ data: {
        streamerId: streamer1,
        userId: user1,
        delta: 20,
        time: data.time2,
        experienceDataChatMessage: { create: {
          ...chatExperienceData2,
          chatMessage: { connect: { externalId: chatMessage2.externalId }}
        }}
      }})
      await db.experienceTransaction.create({ data: {
        streamerId: streamer2, // different streamer
        userId: user1,
        delta: 30,
        time: data.time3,
        experienceDataChatMessage: { create: {
          ...chatExperienceData1,
          chatMessage: { connect: { externalId: chatMessage3.externalId }}
        }}
      }})

      const result = (await experienceStore.getPreviousChatExperience(streamer1, user1))!

      expect(result.user.id).toBe(user1)
      expect(result.delta).toBe(20)
      expect(result.time).toEqual(data.time2)
      expect(result.experienceDataChatMessage).toEqual(expect.objectContaining(chatExperienceData2))
    })
  })

  describe(nameof(ExperienceStore, 'getAllTransactionsStartingAt'), () => {
    test('returns empty array if no transactions at/after specified time', async () => {
      await db.experienceTransaction.createMany({ data: [{
        streamerId: streamer1,
        userId: user1,
        delta: 10,
        time: data.time1 // earlier time
      }, {
        streamerId: streamer2, // different streamer
        userId: user1,
        delta: 30,
        time: data.time3
      }]})

      const result = await experienceStore.getAllTransactionsStartingAt(streamer1, data.time2.getTime())

      expect(result.length).toBe(0)
    })

    test('returns array of correct transactions, including the one starting on the same time', async () => {
      await db.experienceTransaction.createMany({ data: [{
        streamerId: streamer1,
        userId: user1,
        delta: 10,
        time: data.time1
      }, {
        streamerId: streamer1,
        userId: user1,
        delta: 20,
        time: data.time2,
      }, {
        streamerId: streamer1,
        userId: user2,
        delta: 30,
        time: data.time3,
      }, {
        streamerId: streamer2, // different streamer
        userId: user1,
        delta: 40,
        time: data.time3,
      }]})

      const result = await experienceStore.getAllTransactionsStartingAt(streamer1, data.time2.getTime())

      expect(result.length).toBe(2)
      expect(result[0].time).toEqual(data.time2)
      expect(result[1].time).toEqual(data.time3)
    })
  })

  describe(nameof(ExperienceStore, 'getTotalDeltaStartingAt'), () => {
    test('returns zero if no transactions at/after specified time', async () => {
      await db.experienceTransaction.createMany({ data: [{
        streamerId: streamer1,
        userId: user1,
        delta: 10,
        time: data.time1, // earlier time
      }, {
        streamerId: streamer1,
        userId: user2, // different user
        delta: 20,
        time: data.time3,
      }, {
        streamerId: streamer2, // different streamer
        userId: user1,
        delta: 30,
        time: data.time3,
      }]})

      const result = await experienceStore.getTotalDeltaStartingAt(streamer1, user1, data.time2.getTime())

      expect(result).toBe(0)
    })

    test('returns correct delta sum, including the one starting on the same time', async () => {
      await db.experienceTransaction.createMany({ data: [{
        streamerId: streamer1,
        userId: user1,
        delta: 10,
        time: data.time1,
      }, {
        streamerId: streamer1,
        userId: user1,
        delta: 20,
        time: data.time2,
      }, {
        streamerId: streamer1,
        userId: user1,
        delta: 30,
        time: data.time3,
      }]})

      const result = await experienceStore.getTotalDeltaStartingAt(streamer1, user1, data.time2.getTime())

      expect(result).toBe(50)
    })
  })
}
