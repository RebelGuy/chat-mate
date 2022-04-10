import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { evalTwitchPrivateMessage } from '@rebel/server/models/chat'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import ChatService from '@rebel/server/services/ChatService'
import LogService from '@rebel/server/services/LogService'
import TwurpleApiProxyService from '@rebel/server/services/TwurpleApiProxyService'
import ChannelStore from '@rebel/server/stores/ChannelStore'
import { ChatClient } from '@twurple/chat'
import { TwitchPrivateMessage } from '@twurple/chat/lib/commands/TwitchPrivateMessage'

type Deps = Dependencies<{
  logService: LogService
  twurpleChatClientProvider: TwurpleChatClientProvider
  twurpleApiProxyService: TwurpleApiProxyService
  chatService: ChatService
  disableExternalApis: boolean
  twitchChannelName: string
  channelStore: ChannelStore
}>

export default class TwurpleService extends ContextClass {
  readonly name = TwurpleService.name

  private readonly logService: LogService
  private readonly chatClientProvider: TwurpleChatClientProvider
  private readonly twurpleApiProxyService: TwurpleApiProxyService
  private readonly chatService: ChatService
  private readonly disableExternalApis: boolean
  private readonly twitchChannelName: string
  private readonly channelStore: ChannelStore
  private chatClient!: ChatClient

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.chatClientProvider = deps.resolve('twurpleChatClientProvider')
    this.twurpleApiProxyService = deps.resolve('twurpleApiProxyService')
    this.chatService = deps.resolve('chatService')
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.twitchChannelName = deps.resolve('twitchChannelName')
    this.channelStore = deps.resolve('channelStore')
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

  public async unbanChannel (twitchChannelId: number) {
    // there is no API for unbanning a user, but the `ban` implementation is essentially just a wrapper around the `say` method, so we can manually use it here
    const twitchUserName = await this.channelStore.getTwitchUserNameFromChannelId(twitchChannelId)
    this.twurpleApiProxyService.say(`/unban ${twitchUserName}`)
  }

  private onMessage (_channel: string, _user: string, _message: string, msg: TwitchPrivateMessage) {
    const evaluated = evalTwitchPrivateMessage(msg)
    this.logService.logInfo(this, 'Adding 1 new chat item')
    this.chatService.onNewChatItem(evaluated)
  }
}
