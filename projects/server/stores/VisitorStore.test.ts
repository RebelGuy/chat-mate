import { startTestDb, DB_TEST_TIMEOUT, stopTestDb, expectRowCount } from '@rebel/server/_test/db'
import { Db } from '@rebel/server/providers/DbProvider'
import VisitorStore from '@rebel/server/stores/VisitorStore'
import { Dependencies } from '@rebel/shared/context/context'
import { expectObject, nameof } from '@rebel/shared/testUtils'
import { DbError } from '@rebel/shared/util/error'

const DAY_MS = 24 * 3600 * 1000

const day1 = new Date(0)
day1.setUTCFullYear(2024, 6, 28)

const day2 = new Date(0)
day2.setUTCFullYear(2024, 6, 29)

const day3 = new Date(0)
day3.setUTCFullYear(2024, 6, 30)

const day4 = new Date(0)
day4.setUTCFullYear(2024, 6, 31)

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
      const yesterday = Date.now() - DAY_MS
      await db.visitor.createMany({ data: [
        { visitorId: visitorId1 },
        { visitorId: visitorId2, date: new Date(yesterday) },
      ]})

      await visitorStore.addVisitor(visitorId2)

      await expectRowCount(db.visitor).toEqual(3)
    })

    test('Throws if the same visitor already exists for today', async () => {
      const visitorId = 'visitorId'
      await db.visitor.create({ data: { visitorId: visitorId }})

      await expect(() => visitorStore.addVisitor(visitorId)).rejects.toThrowError(DbError)
    })
  })

  describe(nameof(VisitorStore, 'getGroupedUniqueVisitors'), () => {
    test(`Gets today's and yesterday's visitors`, async () => {
      await db.visitor.createMany({ data: [
        { visitorId: visitorId1, date: day1 }, // day 1 (1 visitor)
        { visitorId: visitorId2, date: day2 }, { visitorId: visitorId3, date: day2 }, // day 2 (2 visitors)
        // day 3 (no visitors)
        { visitorId: visitorId1, date: day4 } // day 4 (1 visitor)
      ]})

      const result = await visitorStore.getGroupedUniqueVisitors(day2.getTime())

      expect(result).toEqual(expectObject(result, [
        { timestamp: day2.getTime(), visitors: 2 },
        { timestamp: day4.getTime(), visitors: 1 }
      ]))
    })
  })

  describe(nameof(VisitorStore, 'getUniqueVisitors'), () => {
    test('Returns the number of unique visitor ids', async () => {
      await db.visitor.createMany({ data: [
        { visitorId: visitorId1, date: day1 }, // day 1 (1 visitor)
        { visitorId: visitorId2, date: day2 }, { visitorId: visitorId3, date: day2 }, // day 2 (2 visitors)
        // day 3 (no visitors)
        { visitorId: visitorId1, date: day4 } // day 4 (1 visitor)
      ]})

      const result = await visitorStore.getUniqueVisitors()

      expect(result).toBe(3)
    })
  })

  describe(nameof(VisitorStore, 'getVisitorsForDay'), () => {
    test('Returns the visitors of the given day', async () => {
      await db.visitor.createMany({ data: [
        { visitorId: visitorId1, date: day1 }, // day 1 (1 visitor)
        { visitorId: visitorId2, date: day2 }, { visitorId: visitorId3, date: day2 }, // day 2 (2 visitors)
        // day 3 (no visitors)
        { visitorId: visitorId1, date: day4 } // day 4 (1 visitor)
      ]})

      const result = await visitorStore.getVisitorsForDay(day2.getTime())

      expect(result).toEqual([visitorId2, visitorId3])
    })

    test('Returns an empty array if no visitors are found', async () => {
      await db.visitor.createMany({ data: [
        { visitorId: visitorId1, date: day1 }, // day 1 (1 visitor)
        { visitorId: visitorId2, date: day2 }, { visitorId: visitorId3, date: day2 }, // day 2 (2 visitors)
        // day 3 (no visitors)
        { visitorId: visitorId1, date: day4 } // day 4 (1 visitor)
      ]})

      const result = await visitorStore.getVisitorsForDay(day3.getTime())

      expect(result).toEqual([])
    })
  })
}
