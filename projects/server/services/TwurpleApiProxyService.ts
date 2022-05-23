
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { ITwurpleApi, TwitchMetadata } from '@rebel/server/interfaces'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import LogService from '@rebel/server/services/LogService'
import StatusService from '@rebel/server/services/StatusService'
import { DeepPartial } from '@rebel/server/types'
import { ApiClient } from '@twurple/api'
import { ChatClient, ChatSayMessageAttributes } from '@twurple/chat/lib'

type Deps = Dependencies<{
  logService: LogService
  twurpleStatusService: StatusService
  twurpleApiClientProvider: TwurpleApiClientProvider
  twurpleChatClientProvider: TwurpleChatClientProvider
  twitchChannelName: string
}>

/** Provides access to Twurple API calls - should not be a general proxy, not chat-mate specific (that's what the TwurpleService is for). */
export default class TwurpleApiProxyService extends ContextClass implements ITwurpleApi {
  public name = TwurpleApiProxyService.name

  private readonly logService: LogService
  private readonly statusService: StatusService
  private readonly twurpleApiClientProvider: TwurpleApiClientProvider
  private readonly twurpleChatClientProvider: TwurpleChatClientProvider
  private readonly twitchChannelName: string
  private api!: ApiClient
  private wrappedApi!: DeepPartial<ApiClient>
  private chat!: ChatClient
  private wrappedChat!: DeepPartial<ChatClient>

  private requestId: number

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.statusService = deps.resolve('twurpleStatusService')
    this.twurpleApiClientProvider = deps.resolve('twurpleApiClientProvider')
    this.twurpleChatClientProvider = deps.resolve('twurpleChatClientProvider')
    this.twitchChannelName = deps.resolve('twitchChannelName')

    this.requestId = 0
  }

  public override initialise (): void | Promise<void> {
    this.api = this.twurpleApiClientProvider.get()
    this.wrappedApi = this.createApiWrapper()

    this.chat = this.twurpleChatClientProvider.get()
    this.wrappedChat = this.createChatWrapper()
  }

  public async ban (twitchUserName: string, reason?: string): Promise<void> {
    await this.wrappedChat.ban!(this.twitchChannelName, twitchUserName, reason)
  }

  public async fetchMetadata (): Promise<TwitchMetadata | null> {
    const stream = await this.wrappedApi.streams!.getStreamByUserName!(this.twitchChannelName)

    if (stream == null) {
      return null
    }

    return {
      streamId: stream.id,
      startTime: stream.startDate,
      title: stream.title,
      viewerCount: stream.viewers
    }
  }

  /** Says the message in chat. For the list of available commands that can be said, refer to https://help.twitch.tv/s/article/chat-commands (must include an initial `/`) */
  public async say (message: string) {
    await this.wrappedChat.say!(this.twitchChannelName, message, undefined)
  }

  public async timeout (channel: string, twitchUserName: string, durationSeconds: number, reason?: string) {
    await this.wrappedChat.timeout!(channel, twitchUserName, durationSeconds, reason)
  }

  // insert some middleware to deal with automatic logging and status updates :)
  private createApiWrapper = (): DeepPartial<ApiClient> => {
    const getStreamByUserName = this.wrapRequest((userName: string) => this.api.streams.getStreamByUserName(userName), 'twurpleApiClient.streams.getStreamByUserName')

    return {
      streams: {
        getStreamByUserName
      }
    }
  }

  private createChatWrapper = (): Partial<ChatClient> => {
    const ban = this.wrapRequest((channel: string | undefined, twitchUserName: string, reason: string) => this.chat.ban(channel, twitchUserName, reason), 'twurpleChatClient.ban')
    const timeout = this.wrapRequest((channel: string, twitchUserName: string, duration: number, reason: string) => this.chat.timeout(channel, twitchUserName, duration, reason), 'twurpleChatClient.timeout')
    const say = this.wrapRequest((channel: string, message: string, attributes: ChatSayMessageAttributes | undefined) => this.chat.say(channel, message, attributes), 'twurpleChatClient.say')

    return {
      ban,
      timeout,
      say
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
        // thanks to Twitch's messaging system (or a bug in Twurple?) we don't always hear back, so assume the request failed after 5 seconds
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out.')), 5000))
        response = await Promise.race([request(...query), timeout]) as TResponse
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
