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

  public async addVisitor (visitorId: string, timeString: string) {
    await this.db.visitor.create({ data: {
      visitorId: visitorId,
      timeString: timeString
    }})
  }

  public async getUniqueVisitors (since: number): Promise<number> {
    const result = await this.db.visitor.findMany({
      distinct: 'visitorId',
      where: { time: { gte: new Date(since) }},
      select: { id: true }
    })

    return result.length
  }

  public async getVisitorsForTimeString (timeString: string): Promise<string[]> {
    const result = await this.db.visitor.findMany({
      where: { timeString },
      select: { visitorId: true }
    })

    return result.map(r => r.visitorId)
  }
}
