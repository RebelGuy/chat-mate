
import { ChatResponse, Metadata } from '@rebel/masterchat'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { IMasterchat, ITwurpleApi, TwitchMetadata } from '@rebel/server/interfaces'
import MasterchatProvider from '@rebel/server/providers/MasterchatProvider'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import { DeepPartial } from '@rebel/server/types'
import { ApiClient } from '@twurple/api/lib'

type Deps = Dependencies<{
  logService: LogService
  twurpleStatusService: StatusService
  twurpleApiClientProvider: TwurpleApiClientProvider
  twitchChannelName: string
}>

export default class TwurpleApiProxyService extends ContextClass implements ITwurpleApi {
  public name = TwurpleApiProxyService.name

  private readonly logService: LogService
  private readonly statusService: StatusService
  private readonly twurpleApiClientProvider: TwurpleApiClientProvider
  private readonly twitchChannelName: string
  private api!: ApiClient
  private wrappedApi!: DeepPartial<ApiClient>

  private requestId: number

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.statusService = deps.resolve('twurpleStatusService')
    this.twurpleApiClientProvider = deps.resolve('twurpleApiClientProvider')
    this.twitchChannelName = deps.resolve('twitchChannelName')

    this.requestId = 0
  }

  public override initialise (): void | Promise<void> {
    this.api = this.twurpleApiClientProvider.get()
    this.wrappedApi = this.createWrapper()
  }

  public async fetchMetadata (): Promise<TwitchMetadata> {
    const stream = await this.wrappedApi.streams!.getStreamByUserName!(this.twitchChannelName)

    if (stream == null) {
      throw new Error('Twitch stream is null')
    }

    return {
      streamId: stream.id,
      startTime: stream.startDate,
      title: stream.title,
      viewerCount: stream.viewers
    }
  }

  // insert some middleware to deal with automatic logging and status updates :)
  private createWrapper = (): DeepPartial<ApiClient> => {
    const getStreamByUserName = this.wrapRequest((userName: string) => this.api.streams.getStreamByUserName(userName), 'twurpleApi.streams.getStreamByUserName')

    return {
      streams: {
        getStreamByUserName
      }
    }
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
