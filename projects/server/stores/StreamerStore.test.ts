import { StreamerApplication } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import { Db } from '@rebel/server/providers/DbProvider'
import StreamerStore, { CloseApplicationArgs, CreateApplicationArgs, StreamerApplicationWithUser } from '@rebel/server/stores/StreamerStore'
import { StreamerApplicationAlreadyClosedError, UserAlreadyStreamerError } from '@rebel/server/util/error'
import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { expectObject, nameof } from '@rebel/server/_test/utils'

export default () => {
  const username1 = 'username1'
  const username2 = 'username2'

  let db: Db
  let streamerStore: StreamerStore

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    streamerStore = new StreamerStore(new Dependencies({ dbProvider }))
    db = dbProvider.get()

    await db.registeredUser.createMany({ data: [
      { username: username1, hashedPassword: '123' },
      { username: username2, hashedPassword: '123' }
    ]})

  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(StreamerStore, 'addStreamer'), () => {
    test('Adds the streamer', async () => {
      await db.streamer.create({ data: { registeredUserId: 1 }})

      await streamerStore.addStreamer(2)

      await expectRowCount(db.streamer).toBe(2)
    })

    test('Throws error if the user is already a streamer', async () => {
      await db.streamer.create({ data: { registeredUserId: 1 }})

      await expect(() => streamerStore.addStreamer(1)).rejects.toThrowError(UserAlreadyStreamerError)
    })
  })

  describe(nameof(StreamerStore, 'addStreamerApplication'), () => {
    test('Adds the new streamer application', async () => {
      const data: CreateApplicationArgs = {
        message: 'test',
        registeredUserId: 2
      }

      const result = await streamerStore.addStreamerApplication(data)

      await expectRowCount(db.streamerApplication).toBe(1)
      expect(result.registeredUser.id).toBe(2)
      expect(result.timeClosed).toBeNull()
    })
  })

  describe(nameof(StreamerStore, 'closeStreamerApplication'), () => {
    test('Pending streamer application is approved', async () => {
      const application = await db.streamerApplication.create({ data: { message: 'test', registeredUserId: 1 }})
      const message = 'approved'
      const data: CloseApplicationArgs = { id: application.id, approved: true, message }

      const result = await streamerStore.closeStreamerApplication(data)

      expect(result).toEqual(expectObject<StreamerApplicationWithUser>({ closeMessage: message, isApproved: true, registeredUser: expect.anything() }))
      expect(await db.streamerApplication.findFirst()).toEqual(expectObject<StreamerApplication>({ closeMessage: message, isApproved: true }))
    })

    test('Pending streamer application is rejected', async () => {
      const application = await db.streamerApplication.create({ data: { message: 'test', registeredUserId: 1 }})
      const message = 'rejected'
      const data: CloseApplicationArgs = { id: application.id, approved: false, message }

      const result = await streamerStore.closeStreamerApplication(data)

      expect(result).toEqual(expectObject<StreamerApplicationWithUser>({ closeMessage: message, isApproved: false, registeredUser: expect.anything() }))
      expect(await db.streamerApplication.findFirst()).toEqual(expectObject<StreamerApplication>({ closeMessage: message, isApproved: false }))
    })

    test('Pending streamer application is withdrawn', async () => {
      const application = await db.streamerApplication.create({ data: { message: 'test', registeredUserId: 1 }})
      const message = 'withdrawn'
      const data: CloseApplicationArgs = { id: application.id, approved: null, message }

      const result = await streamerStore.closeStreamerApplication(data)

      expect(result).toEqual(expectObject<StreamerApplicationWithUser>({ closeMessage: message, isApproved: null, registeredUser: expect.anything() }))
      expect(await db.streamerApplication.findFirst()).toEqual(expectObject<StreamerApplication>({ closeMessage: message, isApproved: null }))
    })

    test('Throws if the application is already closed', async () => {
      const application = await db.streamerApplication.create({ data: { message: 'test', registeredUserId: 1, timeClosed: new Date() }})
      const data: CloseApplicationArgs = { id: application.id, approved: true, message: 'throws' }

      await expect(() => streamerStore.closeStreamerApplication(data)).rejects.toThrowError(StreamerApplicationAlreadyClosedError)
    })
  })

  describe(nameof(StreamerStore, 'getStreamerApplications'), () => {
    test('Gets all streamer applications', async () => {
      await db.streamerApplication.createMany({ data: [
        { message: 'test', registeredUserId: 1 },
        { message: 'test', registeredUserId: 2, timeClosed: new Date() }
      ]})

      const result = await streamerStore.getStreamerApplications()

      expect(result.length).toBe(2)
    })
  })

  describe(nameof(StreamerStore, 'getStreamerByName'), () => {
    test('Returns streamer with the given username', async () => {
      await db.streamer.create({ data: { registeredUserId: 2 }})

      const result = await streamerStore.getStreamerByName(username2)

      expect(result!.id).toBe(1)
    })

    test('Returns null if no streamer exists with the given username', async () => {
      await db.streamer.create({ data: { registeredUserId: 2 }})

      const result = await streamerStore.getStreamerByName(username1)

      expect(result).toBeNull()
    })
  })

  describe(nameof(StreamerStore, 'getStreamerByRegisteredUserId'), () => {
    test('Returns streamer with the given id', async () => {
      await db.streamer.create({ data: { registeredUserId: 2 }})

      const result = await streamerStore.getStreamerByRegisteredUserId(2)

      expect(result!.id).toBe(1)
    })

    test('Returns null if no streamer exists with the given id', async () => {
      await db.streamer.create({ data: { registeredUserId: 2 }})

      const result = await streamerStore.getStreamerByRegisteredUserId(1)

      expect(result).toBeNull()
    })
  })
}
