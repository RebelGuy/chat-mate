import { ChatResponse, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { IMasterchat } from '@rebel/server/interfaces'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import MasterchatFactory from '@rebel/server/factories/MasterchatFactory'

type Deps = Dependencies<{
  logService: LogService
  masterchatStatusService: StatusService
  masterchatFactory: MasterchatFactory
}>

export default class MasterchatProxyService extends ContextClass {
  public name = MasterchatProxyService.name

  private readonly logService: LogService
  private readonly statusService: StatusService
  private readonly masterchatFactory: MasterchatFactory

  private readonly wrappedMasterchats: Map<string, IMasterchat>

  private requestId: number

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.statusService = deps.resolve('masterchatStatusService')
    this.masterchatFactory = deps.resolve('masterchatFactory')

    this.wrappedMasterchats = new Map()

    this.requestId = 0
  }

  public addMasterchat (liveId: string) {
    const newMasterchat = this.createWrapper(liveId, this.masterchatFactory.create(liveId))
    this.wrappedMasterchats.set(liveId, newMasterchat)
  }

  public removeMasterchat (liveId: string) {
    this.wrappedMasterchats.delete(liveId)
  }

  public async fetch (liveId: string, continuationToken?: string): Promise<ChatResponse> {
    return await this.wrappedMasterchats.get(liveId)!.fetch(continuationToken)
  }

  public async fetchMetadata (liveId: string): Promise<Metadata> {
    return await this.wrappedMasterchats.get(liveId)!.fetchMetadata()
  }

  // insert some middleware to deal with automatic logging and status updates :)
  private createWrapper = (liveId: string, masterchat: IMasterchat): IMasterchat => {
    // it is important that we wrap the `request` param as an anonymous function itself, because
    // masterchat.* are methods, and so not doing the wrapping would lead to `this` changing context.
    const fetch = this.wrapRequest((...args) => masterchat.fetch(...args), `masterchat[${liveId}].fetch`)
    const fetchMetadata = this.wrapRequest(() => masterchat.fetchMetadata(), `masterchat[${liveId}].fetchMetadata`)

    return { fetch, fetchMetadata }
  }

  private wrapRequest<TQuery extends any[], TResponse> (
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
        response = await request(...query)
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
