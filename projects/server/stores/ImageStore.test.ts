import { startTestDb, DB_TEST_TIMEOUT, stopTestDb } from '@rebel/server/_test/db'
import { Db } from '@rebel/server/providers/DbProvider'
import ImageStore from '@rebel/server/stores/ImageStore'
import { Dependencies } from '@rebel/shared/context/context'
import { nameof } from '@rebel/shared/testUtils'

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

  describe(nameof(ImageStore, 'hasImage'), () => {
    test('Returns true if the specified image exists', async () => {
      await db.image.create({ data: { fingerprint: 'test', height: 0, width: 0, url: 'test' }})

      const result = await imageStore.hasImage('test')

      expect(result).toBe(true)
    })

    test('Returns false if the specified image does not exist', async () => {
      await db.image.create({ data: { fingerprint: 'test', height: 0, width: 0, url: 'test' }})

      const result = await imageStore.hasImage('abc')

      expect(result).toBe(false)
    })
  })
}
