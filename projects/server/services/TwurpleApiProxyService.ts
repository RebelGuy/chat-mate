
import { Dependencies } from '@rebel/server/context/context'
import { ITwurpleApi, TwitchMetadata } from '@rebel/server/interfaces'
import TwurpleApiClientProvider from '@rebel/server/providers/TwurpleApiClientProvider'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import ApiService from '@rebel/server/services/abstract/ApiService'
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

/** Provides access to Twurple API calls - should be a general proxy, not chat-mate specific (that's what the TwurpleService is for). */
export default class TwurpleApiProxyService extends ApiService implements ITwurpleApi {
  private readonly twurpleApiClientProvider: TwurpleApiClientProvider
  private readonly twurpleChatClientProvider: TwurpleChatClientProvider
  private readonly twitchChannelName: string
  private api!: ApiClient
  private wrappedApi!: DeepPartial<ApiClient>
  private chat!: ChatClient
  private wrappedChat!: DeepPartial<ChatClient>

  constructor (deps: Deps) {
    const name = TwurpleApiProxyService.name
    const logService = deps.resolve('logService')
    const statusService = deps.resolve('twurpleStatusService')
    const timeout = 5000 // thanks to Twitch's messaging system (or a bug in Twurple?) we don't always hear back, so assume the request failed after 5 seconds
    super(name, logService, statusService, timeout)
    
    this.twurpleApiClientProvider = deps.resolve('twurpleApiClientProvider')
    this.twurpleChatClientProvider = deps.resolve('twurpleChatClientProvider')
    this.twitchChannelName = deps.resolve('twitchChannelName')
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

  public async mod (channel: string, twitchUserName: string) {
    await this.wrappedChat.mod!(channel, twitchUserName)
  }

  /** Says the message in chat. For the list of available commands that can be said, refer to https://help.twitch.tv/s/article/chat-commands (must include an initial `/`) */
  public async say (message: string) {
    await this.wrappedChat.say!(this.twitchChannelName, message, undefined)
  }

  public async timeout (channel: string, twitchUserName: string, durationSeconds: number, reason?: string) {
    await this.wrappedChat.timeout!(channel, twitchUserName, durationSeconds, reason)
  }

  public async unmod (channel: string, twitchUserName: string) {
    await this.wrappedChat.unmod!(channel, twitchUserName)
  }

  // insert some middleware to deal with automatic logging and status updates :)
  private createApiWrapper = (): DeepPartial<ApiClient> => {
    const getStreamByUserName = super.wrapRequest((userName: string) => this.api.streams.getStreamByUserName(userName), 'twurpleApiClient.streams.getStreamByUserName')

    return {
      streams: {
        getStreamByUserName
      }
    }
  }

  private createChatWrapper = (): Partial<ChatClient> => {
    const ban = super.wrapRequest((channel: string | undefined, twitchUserName: string, reason: string) => this.chat.ban(channel, twitchUserName, reason), 'twurpleChatClient.ban')
    const timeout = super.wrapRequest((channel: string, twitchUserName: string, duration: number, reason: string) => this.chat.timeout(channel, twitchUserName, duration, reason), 'twurpleChatClient.timeout')
    const say = super.wrapRequest((channel: string, message: string, attributes: ChatSayMessageAttributes | undefined) => this.chat.say(channel, message, attributes), 'twurpleChatClient.say')
    const mod = super.wrapRequest((channel: string, twitchUserName: string) => this.chat.mod(channel, twitchUserName), 'twurpleChatClient.mod')
    const unmod = super.wrapRequest((channel: string, twitchUserName: string) => this.chat.unmod(channel, twitchUserName), 'twurpleChatClient.unmod')

    return {
      ban,
      timeout,
      say,
      mod,
      unmod
    }
  }
}
