import { ChatResponse, Masterchat, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { IMasterchat } from '@rebel/server/interfaces'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'

type PartialMasterchat = Pick<Masterchat, 'fetch' | 'fetchMetadata' | 'hide' | 'unhide'>

type Deps = Dependencies<{
  logService: LogService
  masterchatStatusService: StatusService
  masterchatProvider: MasterchatProvider
}>

export default class MasterchatProxyService extends ContextClass implements IMasterchat {
  public name = MasterchatProxyService.name

  private readonly logService: LogService
  private readonly statusService: StatusService
  private readonly masterchat: PartialMasterchat

  private readonly wrappedMasterchat: PartialMasterchat

  private requestId: number

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.statusService = deps.resolve('masterchatStatusService')
    this.masterchat = deps.resolve('masterchatProvider').get()

    this.wrappedMasterchat = this.createWrapper()

    this.requestId = 0
  }

  public async fetch (chatToken?: string): Promise<ChatResponse> {
    // this quirky code is required for typescript to recognise which overloaded `fetch` method we are using
    if (chatToken == null) {
      return await this.wrappedMasterchat.fetch()
    } else {
      return await this.wrappedMasterchat.fetch(chatToken)
    }
  }

  public fetchMetadata (): Promise<Metadata> {
    return this.wrappedMasterchat.fetchMetadata()
  }

  public async banYoutubeChannel (contextMenuEndpointParams: string): Promise<boolean> {
    // only returns null if the action is not available in the context menu, e.g. if the user is already banned
    const result = await this.wrappedMasterchat.hide(contextMenuEndpointParams)
    return result != null
  }

  public async unbanYoutubeChannel (contextMenuEndpointParams: string): Promise<boolean> {
    const result = await this.wrappedMasterchat.unhide(contextMenuEndpointParams)
    return result != null
  }

  // insert some middleware to deal with automatic logging and status updates :)
  private createWrapper = (): PartialMasterchat => {
    // it is important that we wrap the `request` param as an anonymous function itself, because
    // masterchat.* are methods, and so not doing the wrapping would lead to `this` changing context.
    const fetch = this.wrapRequest((...args) => this.masterchat.fetch(...args), 'masterchat.fetch')
    const fetchMetadata = this.wrapRequest(() => this.masterchat.fetchMetadata(), 'masterchat.fetchMetadata')
    const hide = this.wrapRequest((arg) => this.masterchat.hide(arg), 'masterchat.hide')
    const unhide = this.wrapRequest((arg) => this.masterchat.unhide(arg), 'masterchat.unhide')

    return { fetch, fetchMetadata, hide, unhide }
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
