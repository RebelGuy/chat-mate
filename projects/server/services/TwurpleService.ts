import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import IProvider from '@rebel/server/providers/IProvider'
import TwurpleChatClientProvider from '@rebel/server/providers/TwurpleChatClientProvider'
import LogService from '@rebel/server/services/LogService'
import { ClientCredentialsAuthProvider } from '@twurple/auth/lib'
import { ChatClient } from '@twurple/chat/lib'
import { TwitchPrivateMessage } from '@twurple/chat/lib/commands/TwitchPrivateMessage'

type Deps = Dependencies<{
  logService: LogService
  twurpleChatClientProvider: TwurpleChatClientProvider
}>

export default class TwurpleService extends ContextClass {
  readonly name = TwurpleService.name

  private readonly logService: LogService
  private chatClientProvider: TwurpleChatClientProvider

  constructor (deps: Deps) {
    super()
    this.logService = deps.resolve('logService')
    this.chatClientProvider = deps.resolve('twurpleChatClientProvider')
  }

  public override initialise (): void {
    this.chatClientProvider.get().onMessage((channel, user, message, msg) => this.onMessage(channel, user, message, msg))
  }

  private onMessage (channel: string, user: string, message: string, msg: TwitchPrivateMessage) {
    this.logService.logDebug(this, 'onMessage', channel, user, message, msg)
  }
}
