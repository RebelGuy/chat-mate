import { ChatResponse, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import { IMasterchat } from '@rebel/server/interfaces'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'

type Deps = Dependencies<{
  logService: LogService
  statusService: StatusService
  masterchatProvider: MasterchatProvider
}>

export default class MasterchatProxyService implements IMasterchat {
  public name = MasterchatProxyService.name

  private readonly logService: LogService
  private readonly statusService: StatusService
  private readonly masterchat: IMasterchat

  private readonly wrappedMasterchat: IMasterchat

  private requestId: number

  constructor (deps: Deps) {
    this.logService = deps.resolve('logService')
    this.statusService = deps.resolve('statusService')
    this.masterchat = deps.resolve('masterchatProvider').get()

    this.wrappedMasterchat = this.createWrapper()

    this.requestId = 0
  }

  public fetch (chatToken?: string): Promise<ChatResponse> {
    return this.wrappedMasterchat.fetch(chatToken)
  }

  public fetchMetadata (): Promise<Metadata> {
    return this.wrappedMasterchat.fetchMetadata()
  }

  // insert some middleware to deal with automatic logging and status updates :)
  private createWrapper (): IMasterchat {
    const fetch = this.wrapRequest(this.masterchat.fetch, 'masterchat.fetch')
    const fetchMetadata = this.wrapRequest(this.masterchat.fetchMetadata, 'masterchat.fetchMetadata')

    return { fetch, fetchMetadata }
  }

  private wrapRequest<TQuery extends any[], TResponse> (
    request: (...query: TQuery) => Promise<TResponse>,
    requestName: string
  ): (...query: TQuery) => Promise<TResponse> {
    return async (...query: TQuery) => {
      // set up
      const id = this.requestId++
      const startTime = Date.now();

      // do request
      let error: any | null = null
      let response: TResponse | null = null
      this.logService.logApiRequest(this, id, requestName, { ...query })
      try {
        response = await request(...query)
        this.logService.logApiResponse(this, id, false, response)
      } catch (e) {
        error = e
        this.logService.logApiResponse(this, id, false, e)
      }
      const finishTime = Date.now()

      // notify
      const duration = finishTime - startTime
      const status = error == null ? 'ok' : 'error'
      this.statusService.onMasterchatRequest(finishTime, status, duration)

      // return
      if (error) {
        throw error
      } else {
        return response!
      }
    }
  }
}
