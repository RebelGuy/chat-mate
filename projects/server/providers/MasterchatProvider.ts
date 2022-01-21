import { Dependencies } from '@rebel/server/context/context';
import IProvider from '@rebel/server/providers/IProvider';
import { IMasterchat } from '@rebel/server/interfaces';
import MockMasterchat from '@rebel/server/mocks/MockMasterchat'
import LogService from '@rebel/server/services/LogService'
import { Masterchat } from '@rebel/masterchat';
import StatusService from '@rebel/server/services/StatusService'

type Deps = Dependencies<{
  liveId: string,
  channelId: string,
  auth: string,
  isMockLivestream: boolean | null,
  logService: LogService,
  statusService: StatusService
}>

export default class MasterchatProvider implements IProvider<IMasterchat> {
  readonly name = MasterchatProvider.name

  private readonly liveId: string
  private readonly channelId: string
  private readonly auth: string
  private readonly isMockLivestream: boolean | null
  private readonly logService: LogService
  private readonly statusService: StatusService

  private readonly masterchat: IMasterchat
  private readonly masterchatWrapper: IMasterchat

  private requestId: number

  constructor (deps: Deps) {
    this.liveId = deps.resolve('liveId')
    this.channelId = deps.resolve('channelId')
    this.auth = deps.resolve('auth')
    this.isMockLivestream = deps.resolve('isMockLivestream')
    this.logService = deps.resolve('logService')
    this.statusService = deps.resolve('statusService')

    if (this.isMockLivestream) {
      this.logService.logInfo(this, 'Using MockMasterchat for auto-playing data')
      this.masterchat = new MockMasterchat(this.logService)
    } else {
      // note: there is a bug where the "live chat" (as opposed to "top chat") option in FetchChatOptions doesn't work,
      // so any messages that might be spammy/inappropriate will not show up.
      this.masterchat = new Masterchat(this.liveId, this.channelId, { mode: 'live', credentials: this.auth })
    }

    this.requestId = 0
    this.masterchatWrapper = this.createWrapper()
  }

  public get (): IMasterchat {
    return this.masterchatWrapper
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
