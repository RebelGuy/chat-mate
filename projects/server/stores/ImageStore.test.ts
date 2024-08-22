import { startTestDb, DB_TEST_TIMEOUT, stopTestDb } from '@rebel/server/_test/db'
import { Db } from '@rebel/server/providers/DbProvider'
import ImageStore from '@rebel/server/stores/ImageStore'
import { Dependencies } from '@rebel/shared/context/context'
import { expectObject, nameof } from '@rebel/shared/testUtils'

export default () => {
  let imageStore: ImageStore
  let db: Db

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    imageStore = new ImageStore(new Dependencies({
      dbProvider
    }))
    db = dbProvider.get()

  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(ImageStore, 'getImageByFingerprint'), () => {
    test('Returns the specified image', async () => {
      await db.image.create({ data: { fingerprint: 'test', height: 0, width: 0, url: 'test' }})

      const result = await imageStore.getImageByFingerprint('test')

      expect(result).toEqual(expectObject(result, { fingerprint: 'test' }))
    })

    test('Returns null if the specified image does not exist', async () => {
      await db.image.create({ data: { fingerprint: 'test', height: 0, width: 0, url: 'test' }})

      const result = await imageStore.getImageByFingerprint('abc')

      expect(result).toBeNull()
    })
  })
}
