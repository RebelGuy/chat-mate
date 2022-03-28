import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import IProvider from '@rebel/server/providers/IProvider'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import LogService, { createLogContext, LogContext, onTwurpleClientLog } from '@rebel/server/services/LogService'
import { ChatClient, LogLevel } from '@twurple/chat'
import { assertUnreachable } from '@rebel/server/util/typescript'

type Deps = Dependencies<{
  twurpleAuthProvider: TwurpleAuthProvider
  logService: LogService
  twitchChannelName: string
  disableExternalApis: boolean
}>

export default class TwurpleChatClientProvider extends ContextClass implements IProvider<ChatClient> {
  readonly name = TwurpleChatClientProvider.name

  private readonly twurkpleAuthProvider: TwurpleAuthProvider
  private readonly logService: LogService
  private readonly logContext: LogContext
  private readonly twitchChannelName: string
  private readonly disableExternalApis: boolean
  private chatClient!: ChatClient

  constructor (deps: Deps) {
    super()
    this.twurkpleAuthProvider = deps.resolve('twurpleAuthProvider')
    this.logService = deps.resolve('logService')
    this.logContext = createLogContext(this.logService, this)
    this.twitchChannelName = deps.resolve('twitchChannelName')
    this.disableExternalApis = deps.resolve('disableExternalApis')
  }

  override async initialise (): Promise<void> {
    this.chatClient = new ChatClient({
      authProvider: this.twurkpleAuthProvider.get(),
      channels: [this.twitchChannelName],
      isAlwaysMod: true,

      // inject custom logging
      logger: {
        custom: {
          log: (level: LogLevel, message: string) => onTwurpleClientLog(this.logContext, level, message)
        }
      }
    })

    if (this.disableExternalApis) {
      return
    }

    await this.chatClient.connect()
    this.logService.logInfo(this, 'Connected to the Twurple chat client')
  }

  override async dispose (): Promise<void> {
    await this.chatClient.quit()
    
    this.logService.logInfo(this, 'Disconnected from the Twurple chat client')
  }

  get () {
    return this.chatClient
  }
}
