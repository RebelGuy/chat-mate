import { ChatResponse, Masterchat, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { IMasterchat } from '@rebel/server/interfaces'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import MasterchatFactory from '@rebel/server/factories/MasterchatFactory'

type PartialMasterchat = Pick<Masterchat, 'fetch' | 'fetchMetadata' | 'hide' | 'unhide' | 'timeout'>

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

  private readonly wrappedMasterchats: Map<string, PartialMasterchat>

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

  // the second argument is not optional to avoid bugs where `fetch(continuationToken)` is erroneously called.
  public async fetch (liveId: string, continuationToken: string | undefined): Promise<ChatResponse> {
    // this quirky code is required for typescript to recognise which overloaded `fetch` method we are using
    if (continuationToken == null) {
      return await this.wrappedMasterchats.get(liveId)!.fetch()
    } else {
      return await this.wrappedMasterchats.get(liveId)!.fetch(continuationToken)
    }
  }

  public async fetchMetadata (liveId: string): Promise<Metadata> {
    return await this.wrappedMasterchats.get(liveId)!.fetchMetadata()
  }

  public async banYoutubeChannel (contextMenuEndpointParams: string): Promise<boolean> {
    // only returns null if the action is not available in the context menu, e.g. if the user is already banned
    const result = await this.wrappedMasterchat.hide(contextMenuEndpointParams)
    return result != null
  }

  /** Times out the channel by 5 minutes. This cannot be undone. */
  public async timeout (contextMenuEndpointParams: string): Promise<boolean> {
    const result = await this.wrappedMasterchat.timeout(contextMenuEndpointParams)
    return result != null
  }

  public async unbanYoutubeChannel (contextMenuEndpointParams: string): Promise<boolean> {
    const result = await this.wrappedMasterchat.unhide(contextMenuEndpointParams)
    return result != null
  }

  // insert some middleware to deal with automatic logging and status updates :)
  private createWrapper = (liveId: string, masterchat: Masterchat): PartialMasterchat => {
    // it is important that we wrap the `request` param as an anonymous function itself, because
    // masterchat.* are methods, and so not doing the wrapping would lead to `this` changing context.
    const fetch = this.wrapRequest((...args) => masterchat.fetch(...args), `masterchat[${liveId}].fetch`)
    const fetchMetadata = this.wrapRequest(() => masterchat.fetchMetadata(), `masterchat[${liveId}].fetchMetadata`)
    const hide = this.wrapRequest((arg) => masterchat.hide(arg), `masterchat[${liveId}].hide`)
    const unhide = this.wrapRequest((arg) => masterchat.unhide(arg), `masterchat[${liveId}].unhide`)
    const timeout = this.wrapRequest((arg) => masterchat.timeout(arg), `masterchat[${liveId}].timeout`)

    return { fetch, fetchMetadata, hide, unhide, timeout }
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
