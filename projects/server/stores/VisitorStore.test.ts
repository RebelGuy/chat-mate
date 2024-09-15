import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { Db } from '@rebel/server/providers/DbProvider'
import VisitorStore from '@rebel/server/stores/VisitorStore'
import { Dependencies } from '@rebel/shared/context/context'
import { nameof } from '@rebel/shared/testUtils'
import { DbError } from '@rebel/shared/util/error'
import * as data from '@rebel/server/_test/testData'

const visitorId1 = 'visitor1'
const visitorId2 = 'visitor2'
const visitorId3 = 'visitor3'

export default () => {
  let db: Db
  let visitorStore: VisitorStore

  beforeEach(async () => {
    const dbProvider = await startTestDb()
    visitorStore = new VisitorStore(new Dependencies({ dbProvider }))
    db = dbProvider.get()
  }, DB_TEST_TIMEOUT)

  afterEach(stopTestDb)

  describe(nameof(VisitorStore, 'addVisitor'), () => {
    test('Adds the visitor to the database', async () => {
      await db.visitor.createMany({ data: [
        { visitorId: visitorId1, timeString: '1' },
        { visitorId: visitorId2, timeString: '1' },
      ]})

      await visitorStore.addVisitor(visitorId2, '2')

      await expectRowCount(db.visitor).toEqual(3)
    })

    test('Throws if the same visitor with the same time string already exists', async () => {
      const visitorId = 'visitorId'
      await db.visitor.create({ data: { visitorId: visitorId, timeString: '1' }})

      await expect(() => visitorStore.addVisitor(visitorId, '1')).rejects.toThrowError(DbError)
    })
  })

  describe(nameof(VisitorStore, 'getUniqueVisitors'), () => {
    test('Returns the number of unique visitor ids', async () => {
      await db.visitor.createMany({ data: [
        { visitorId: visitorId1, timeString: '1', time: data.time1 }, // day 1 (1 visitor)
        { visitorId: visitorId2, time: data.time2, timeString: '2' }, { visitorId: visitorId3, time: data.time2, timeString: '2' }, // day 2 (2 visitors)
        // day 3 (no visitors)
        { visitorId: visitorId1, time: data.time4, timeString: '4' } // day 4 (1 visitor)
      ]})

      const result = await visitorStore.getUniqueVisitors(0)

      expect(result).toBe(3)
    })
  })

  describe(nameof(VisitorStore, 'getVisitorsForTimeString'), () => {
    test('Returns the visitors of the given day', async () => {
      await db.visitor.createMany({ data: [
        { visitorId: visitorId1, time: data.time1, timeString: '1' }, // day 1 (1 visitor)
        { visitorId: visitorId2, time: data.time2, timeString: '2' }, { visitorId: visitorId3, time: data.time2, timeString: '2' }, // day 2 (2 visitors)
        // day 3 (no visitors)
        { visitorId: visitorId1, time: data.time4, timeString: '4' } // day 4 (1 visitor)
      ]})

      const result = await visitorStore.getVisitorsForTimeString('2')

      expect(result).toEqual([visitorId2, visitorId3])
    })

    test('Returns an empty array if no visitors are found', async () => {
      await db.visitor.createMany({ data: [
        { visitorId: visitorId1, time: data.time1, timeString: '1' }, // day 1 (1 visitor)
        { visitorId: visitorId2, time: data.time2, timeString: '2' }, { visitorId: visitorId3, time: data.time2, timeString: '2' }, // day 2 (2 visitors)
        // day 3 (no visitors)
        { visitorId: visitorId1, time: data.time4, timeString: '4' } // day 4 (1 visitor)
      ]})

      const result = await visitorStore.getVisitorsForTimeString('3')

      expect(result).toEqual([])
    })
  })
}
