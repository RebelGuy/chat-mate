import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { evalTwitchPrivateMessage } from '@rebel/server/models/chat'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import ChatService from '@rebel/server/services/ChatService'
import LogService from '@rebel/server/services/LogService'
import { ChatClient } from '@twurple/chat'
import { TwitchPrivateMessage } from '@twurple/chat/lib/commands/TwitchPrivateMessage'

type Deps = Dependencies<{
  logService: LogService
  twurpleChatClientProvider: TwurpleChatClientProvider
  chatService: ChatService
  disableExternalApis: boolean
}>

export default class TwurpleService extends ContextClass {
  readonly name = TwurpleService.name

  private readonly logService: LogService
  private readonly chatClientProvider: TwurpleChatClientProvider
  private readonly chatService: ChatService
  private readonly disableExternalApis: boolean
  private chatClient!: ChatClient

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.chatClientProvider = deps.resolve('twurpleChatClientProvider')
    this.chatService = deps.resolve('chatService')
    this.disableExternalApis = deps.resolve('disableExternalApis')
  }

  public override initialise (): void {
    this.chatClient = this.chatClientProvider.get()
    if (this.disableExternalApis) {
      return
    }

    this.chatClient.onMessage((channel, user, message, msg) => this.onMessage(channel, user, message, msg))
  }

  private onMessage (_channel: string, _user: string, _message: string, msg: TwitchPrivateMessage) {
    const evaluated = evalTwitchPrivateMessage(msg)
    this.logService.logInfo(this, 'Adding 1 new chat item')
    this.chatService.onNewChatItem(evaluated)
  }
}
