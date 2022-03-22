import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import IProvider from '@rebel/server/providers/IProvider'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import LogService from '@rebel/server/services/LogService'
import { ChatClient, LogLevel } from '@twurple/chat'
import { assertUnreachable } from '@rebel/server/util/typescript'

type Deps = Dependencies<{
  twurpleAuthProvider: TwurpleAuthProvider
  logService: LogService
  twitchChannelName: string
}>

export default class TwurpleChatClientProvider extends ContextClass implements IProvider<ChatClient> {
  readonly name = TwurpleChatClientProvider.name

  private readonly twurkpleAuthProvider: TwurpleAuthProvider
  private readonly logService: LogService
  private readonly twitchChannelName: string
  private chatClient!: ChatClient

  constructor (deps: Deps) {
    super()
    this.twurkpleAuthProvider = deps.resolve('twurpleAuthProvider')
    this.logService = deps.resolve('logService')
    this.twitchChannelName = deps.resolve('twitchChannelName')
  }

  override async initialise (): Promise<void> {
    this.chatClient = new ChatClient({
      authProvider: this.twurkpleAuthProvider.get(),
      channels: [this.twitchChannelName],
      isAlwaysMod: true,

      // inject custom logging
      logger: {
        custom: {
          log: (level: LogLevel, message: string) => this.onChatClientLog(level, message)
        }
      }
    })
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

  private onChatClientLog (level: LogLevel, message: string): void {
    switch (level) {
      case LogLevel.CRITICAL:
      case LogLevel.ERROR:
        this.logService.logError(this, message)
        break
      case LogLevel.WARNING:
        this.logService.logWarning(this, message)
        break
      case LogLevel.INFO:
        this.logService.logInfo(this, message)
        break
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
        this.logService.logDebug(this, message)
        break
      default:
        assertUnreachable(level)
    }
  }
}
