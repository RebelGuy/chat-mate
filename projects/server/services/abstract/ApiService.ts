import ContextClass from '@rebel/server/context/ContextClass'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import { NO_OP } from '@rebel/server/util/typescript'

export default abstract class ApiService extends ContextClass {
  public readonly name: string

  protected readonly logService: LogService
  private readonly statusService: StatusService
  private readonly timeoutMs: number | null

  private requestId: number

  constructor (name: string, logService: LogService, statusService: StatusService, timeoutMs: number | null) {
    super()
    this.name = name
    this.logService = logService
    this.statusService = statusService
    this.timeoutMs = timeoutMs

    this.requestId = 0
  }

  /** Base wrapper that takes care of logging, timeouts, and updating the underlying status service. */
  public wrapRequest<TQuery extends any[], TResponse> (
    request: (...query: TQuery) => Promise<TResponse>,
    requestName: string
  ): (...query: TQuery) => Promise<TResponse> {
    return async (...query: TQuery) => {
      // set up
      const id = this.requestId++
      const startTime = Date.now()

      // do request
      let error: any | null = null
      let response: TResponse | null = null
      this.logService.logApiRequest(this, id, requestName, { ...query })
      try {
        let timeoutPromise
        if (this.timeoutMs == null) {
          timeoutPromise = new Promise(NO_OP)
        } else {
          timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out.')), this.timeoutMs!))
        }

        response = await Promise.race([request(...query), timeoutPromise]) as TResponse
        this.logService.logApiResponse(this, id, false, response)
      } catch (e) {
        error = e
        this.logService.logApiResponse(this, id, true, e)
      }
      const finishTime = Date.now()

      // notify
      const duration = finishTime - startTime
      const status = error == null ? 'ok' : 'error'
      this.statusService.onRequestDone(finishTime, status, duration)

      // return
      if (error) {
        throw error
      } else {
        return response!
      }
    }
  }
}
