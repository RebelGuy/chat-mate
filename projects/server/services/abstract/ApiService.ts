import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import { NO_OP } from '@rebel/shared/util/typescript'
import { transformPrimitiveValues } from '@rebel/shared/util/objects'
import { DataObject, rawDataSymbol } from '@twurple/common'
import PlatformApiStore, { ApiPlatform } from '@rebel/server/stores/PlatformApiStore'

export default abstract class ApiService extends SingletonContextClass {
  public readonly name: string

  protected readonly logService: LogService
  private readonly statusService: StatusService
  private readonly platformApiStore: PlatformApiStore
  private readonly apiPlatform: ApiPlatform
  private readonly timeoutMs: number | null
  private readonly trimLogs: boolean

  private requestId: number

  constructor (name: string, logService: LogService, statusService: StatusService, platformApiStore: PlatformApiStore, apiPlatform: ApiPlatform, timeoutMs: number | null, trimLogs: boolean) {
    super()
    this.name = name
    this.logService = logService
    this.statusService = statusService
    this.platformApiStore = platformApiStore
    this.apiPlatform = apiPlatform
    this.timeoutMs = timeoutMs
    this.trimLogs = trimLogs

    this.requestId = 0
  }

  /** Base wrapper that takes care of logging, timeouts, and updating the underlying status service. */
  public wrapRequest<TQuery extends any[], TResponse> (
    request: (...query: TQuery) => Promise<TResponse>,
    requestName: string,
    streamerId: number,
    skipPlatformLogIfSuccessful?: boolean
  ): (...query: TQuery) => Promise<TResponse> {
    return async (...query: TQuery) => {
      // set up
      const id = this.requestId++
      const startTime = Date.now()

      // do request
      let error: Error | null = null
      let response: TResponse | null = null
      const queryToLog = this.wrapQuery(query)
      this.logService.logApiRequest(this, id, requestName, queryToLog)
      try {
        let timeoutPromise
        if (this.timeoutMs == null) {
          timeoutPromise = new Promise(NO_OP)
        } else {
          timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out.')), this.timeoutMs!))
        }

        response = await Promise.race([request(...query), timeoutPromise]) as TResponse
        const responseToLog = this.getResponseToLog(response)
        this.logService.logApiResponse(this, id, false, responseToLog)
      } catch (e: any) {
        error = e as Error
        this.logService.logApiResponse(this, id, true, e)
      }
      const finishTime = Date.now()

      // notify
      const duration = finishTime - startTime
      const status = error == null ? 'ok' : 'error'
      this.statusService.onRequestDone(finishTime, status, duration)

      if (!skipPlatformLogIfSuccessful || error != null) {
        try {
          await this.platformApiStore.addApiRequest(streamerId, this.apiPlatform, startTime, finishTime, requestName, JSON.stringify(queryToLog), error?.message ?? null)
        } catch (e: any) {
          this.logService.logError(this, `Unable to log API usage of ${this.apiPlatform} for streamer ${streamerId} for endpoint ${requestName}:`, e)
        }
      }

      // return
      if (error) {
        throw error
      } else {
        return response!
      }
    }
  }

  private getResponseToLog (response: unknown): unknown {
    if (response instanceof DataObject) {
      return response[rawDataSymbol]
    }

    if (!this.trimLogs || typeof response !== 'object' || response == null) {
      return response
    }

    try {
      return transformPrimitiveValues(response as Record<any, any>, (key, value) => {
        if (typeof value !== 'string' || value.length <= 10) {
          return value
        }

        if (key === 'token' || key === 'contextMenuEndpointParams') {
          return value.substring(0, 10) + '...'
        } else {
          return value
        }
      })
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        return response
      }

      this.logService.logWarning(this, 'Attempted to trim response but encountered error:', e)
      return response
    }
  }

  private wrapQuery (params: any[]): Record<string, any> {
    let obj = { ...params } as Record<string, any>

    if (this.trimLogs) {
      try {
        obj = transformPrimitiveValues(obj, (key, value) => {
          if (typeof value === 'string' && value.length > 50) {
            return value.substring(0, 10) + '...'
          } else {
            return value
          }
        })
      } catch (e: any) {
        this.logService.logWarning(this, 'Attempted to trim query but encountered error:', e)
      }
    }

    return obj
  }
}
