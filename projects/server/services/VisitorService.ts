import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import VisitorHelpers from '@rebel/server/helpers/VisitorHelpers'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'
import LogService from '@rebel/server/services/LogService'
import VisitorStore from '@rebel/server/stores/VisitorStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { hashString } from '@rebel/shared/util/strings'

type Deps = Dependencies<{
  chatMateStateService: ChatMateStateService
  logService: LogService
  visitorStore: VisitorStore
  dateTimeHelpers: DateTimeHelpers
  visitorHelpers: VisitorHelpers
}>

export default class VisitorService extends ContextClass {
  public readonly name = VisitorService.name

  private readonly chatMateStateService: ChatMateStateService
  private readonly logService: LogService
  private readonly visitorStore: VisitorStore
  private readonly dateTimeHelpers: DateTimeHelpers
  private readonly visitorHelpers: VisitorHelpers

  constructor (deps: Deps) {
    super()

    this.chatMateStateService = deps.resolve('chatMateStateService')
    this.logService = deps.resolve('logService')
    this.visitorStore = deps.resolve('visitorStore')
    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
    this.visitorHelpers = deps.resolve('visitorHelpers')
  }

  public async addVisitor (ip: string): Promise<void> {
    const hashedIp = hashString(ip)
    const timeString = this.visitorHelpers.getTimeString(this.dateTimeHelpers.now()) // get the timeString immediately since we might be waiting for the semaphore
    const semaphore = this.chatMateStateService.getVisitorCountSemaphore()

    try {
      await semaphore.enter(hashedIp)

      // we add the visitor to the cache regardless of whether the database request might fail,
      // because it's really not that important. as long as it's fast and about right, i'm
      const newVisitor = this.chatMateStateService.cacheVisitor(hashedIp, timeString)
      if (!newVisitor) {
        return
      }

      await this.visitorStore.addVisitor(hashedIp, timeString)
    } catch (e: any) {
      // todo: handle duplicate entry error
      this.logService.logError(this, `Unable to add visitor ${hashedIp} to the database:`, e)
    } finally {
      semaphore.exit(hashedIp)
    }
  }
}
