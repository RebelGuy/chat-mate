import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'
import LogService from '@rebel/server/services/LogService'
import VisitorStore from '@rebel/server/stores/VisitorStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { single } from '@rebel/shared/util/arrays'
import { hashString } from '@rebel/shared/util/strings'

type Deps = Dependencies<{
  chatMateStateService: ChatMateStateService
  logService: LogService
  visitorStore: VisitorStore
  dateTimeHelpers: DateTimeHelpers
}>

export default class VisitorService extends ContextClass {
  public readonly name = VisitorService.name

  private readonly chatMateStateService: ChatMateStateService
  private readonly logService: LogService
  private readonly visitorStore: VisitorStore
  private readonly dateTimeHelpers: DateTimeHelpers

  constructor (deps: Deps) {
    super()

    this.chatMateStateService = deps.resolve('chatMateStateService')
    this.logService = deps.resolve('logService')
    this.visitorStore = deps.resolve('visitorStore')
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
  }

  public async addVisitor (ip: string): Promise<void> {
    const hashedIp = hashString(ip)
    const semaphore = this.chatMateStateService.getVisitorCountSemaphore()

    try {
      await semaphore.enter(hashedIp)

      // we add the visitor to the cache regardless of whether the database request might fail,
      // because it's really not that important. as long as it's fast and about right, i'm
      const newVisitor = this.chatMateStateService.cacheVisitor(hashedIp)
      if (!newVisitor) {
        return
      }

      await this.visitorStore.addVisitor(hashedIp)
    } catch (e: any) {
      // todo: handle duplicate entry error
      this.logService.logError(this, `Unable to add visitor ${hashedIp} to the database:`, e)
    } finally {
      semaphore.exit(hashedIp)
    }
  }

  public async getUniqueVisitorsToday (): Promise<number> {
    const startOfDay = this.dateTimeHelpers.getStartOfToday()
    const grouped = await this.visitorStore.getGroupedUniqueVisitors(startOfDay)
    return single(grouped).visitors
  }
}
