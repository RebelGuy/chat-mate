import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { evalTwitchPrivateMessage } from '@rebel/server/models/chat'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import ChatService from '@rebel/server/services/ChatService'
import EventDispatchService from '@rebel/server/services/EventDispatchService'
import LogService from '@rebel/server/services/LogService'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import { ChatClient } from '@twurple/chat'
import { TwitchPrivateMessage } from '@twurple/chat/lib/commands/TwitchPrivateMessage'

type Deps = Dependencies<{
  logService: LogService
  twurpleChatClientProvider: TwurpleChatClientProvider
  twurpleApiProxyService: TwurpleApiProxyService
  disableExternalApis: boolean
  twitchChannelName: string
  channelStore: ChannelStore
  eventDispatchService: EventDispatchService
}>

export default class TwurpleService extends ContextClass {
  readonly name = TwurpleService.name

  private readonly logService: LogService
  private readonly chatClientProvider: TwurpleChatClientProvider
  private readonly twurpleApiProxyService: TwurpleApiProxyService
  private readonly disableExternalApis: boolean
  private readonly twitchChannelName: string
  private readonly channelStore: ChannelStore
  private readonly eventDispatchService: EventDispatchService
  private chatClient!: ChatClient

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.chatClientProvider = deps.resolve('twurpleChatClientProvider')
    this.twurpleApiProxyService = deps.resolve('twurpleApiProxyService')
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.twitchChannelName = deps.resolve('twitchChannelName')
    this.channelStore = deps.resolve('channelStore')
    this.eventDispatchService = deps.resolve('eventDispatchService')
  }

  public override initialise () {
    this.chatClient = this.chatClientProvider.get()
    if (this.disableExternalApis) {
      return
    }

    this.chatClient.onMessage((channel, user, message, msg) => this.onMessage(channel, user, message, msg))

    this.chatClient.onAuthenticationFailure(msg => this.logService.logError(this, 'chatClient.onAuthenticationFailure', msg))
    this.chatClient.onMessageFailed((chanel, reason) => this.logService.logError(this, 'chatClient.onMessageFailed', reason))
    this.chatClient.onMessageRatelimit((channel, msg) => this.logService.logError(this, 'chatClient.onMessageRatelimit', msg))
    this.chatClient.onNoPermission((channel, msg) => this.logService.logError(this, 'chatClient.onNoPermission', msg))

    // todo: how do these compare to the EventSub?
    this.chatClient.onBan((channel, user) => this.logService.logInfo(this, 'chatClient.onBan', user))
    this.chatClient.onTimeout((channel, user, duration) => this.logService.logInfo(this, 'chatClient.onTimeout', user, duration))

    // represents an info message in chat, e.g. confirmation that an action was successful
    this.chatClient.onNotice((target, user, msg, notice) => this.logService.logInfo(this, 'chatClient.onNotice', msg))
  }

  public async banChannel (twitchChannelId: number, reason: string | null) {
    const twitchUserName = await this.channelStore.getTwitchUserNameFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.ban(twitchUserName, reason ?? undefined)
  }
  
  public async timeout (twitchChannelId: number, reason: string | null, durationSeconds: number) {
    const twitchUserName = await this.channelStore.getTwitchUserNameFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.timeout(this.twitchChannelName, twitchUserName, durationSeconds, reason ?? undefined)
  }

  public async unbanChannel (twitchChannelId: number) {
    // there is no API for unbanning a user, but the `ban` implementation is essentially just a wrapper around the `say` method, so we can manually use it here
    const twitchUserName = await this.channelStore.getTwitchUserNameFromChannelId(twitchChannelId)
    this.twurpleApiProxyService.say(`/unban ${twitchUserName}`)
  }

  public async untimeout (twitchChannelId: number, reason: string | null) {
    // there is no API for removing a timeout, but a legitimate workaround is to add a new timeout that lasts for 1 second, which will overwrite the existing timeout
    const twitchUserName = await this.channelStore.getTwitchUserNameFromChannelId(twitchChannelId)
    await this.twurpleApiProxyService.timeout(this.twitchChannelName, twitchUserName, 1, reason ?? undefined)
  }

  private onMessage (_channel: string, _user: string, _message: string, msg: TwitchPrivateMessage) {
    const evaluated = evalTwitchPrivateMessage(msg)
    this.logService.logInfo(this, 'Adding 1 new chat item')
    this.eventDispatchService.addData('chatItem', evaluated)
  }
}
