import DbProvider, { Db } from '@rebel/server/providers/DbProvider'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'

type Deps = Dependencies<{
  dbProvider: DbProvider
}>

export type GroupedVisitors = {
  /** The timestamp that marks the beginning of the day for which we are counting the visitors. */
  timestamp: number

  /** The visitor count for the current day. */
  visitors: number
}

export default class VisitorStore extends ContextClass {
  private readonly db: Db

  constructor (deps: Deps) {
    super()

    this.db = deps.resolve('dbProvider').get()
  }

  public async addVisitor (visitorId: string) {
    await this.db.visitor.create({ data: {
      visitorId: visitorId
    }})
  }

  /** Returns the number of unique visitors for each day since the given timestamp, in ascending order.
   * It is expected that the given timestamp marks the beginning of a day.
   * Empty groups are omitted. */
  public async getGroupedUniqueVisitors (startOfDay: number): Promise<GroupedVisitors[]> {
    const groups = await this.db.visitor.groupBy({
      by: 'date',
      where: { date: { gte: new Date(startOfDay) } },
      _count: { visitorId: true },
      orderBy: { date: 'asc' }
    })

    return groups.map(g => ({ timestamp: g.date.getTime(), visitors: g._count.visitorId }))
  }

  public async getUniqueVisitors (): Promise<number> {
    const result = await this.db.visitor.findMany({
      distinct: 'visitorId',
      select: { id: true }
    })

    return result.length
  }

  /** Returns the array of visitor ids for the given day. May be empty.
   * It is expected that the given timestamp marks the beginning of a day. */
  public async getVisitorsForDay (startOfDay: number): Promise<string[]> {
    const result = await this.db.visitor.findMany({
      where: { date: new Date(startOfDay) }
    })

    return result.map(r => r.visitorId)
  }
}
