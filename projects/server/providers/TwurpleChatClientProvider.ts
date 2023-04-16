import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import IProvider from '@rebel/server/providers/IProvider'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import LogService, { onTwurpleClientLog } from '@rebel/server/services/LogService'
import { ChatClient, LogLevel } from '@twurple/chat'
import { LogContext, createLogContext } from '@rebel/shared/ILogService'
import { waitUntil } from '@rebel/shared/util/typescript'

type Deps = Dependencies<{
  twurpleAuthProvider: TwurpleAuthProvider
  logService: LogService
  disableExternalApis: boolean
}>

export default class TwurpleChatClientProvider extends ContextClass implements IProvider<ChatClient> {
  readonly name = TwurpleChatClientProvider.name

  private readonly twurkpleAuthProvider: TwurpleAuthProvider
  private readonly logService: LogService
  private readonly logContext: LogContext
  private readonly disableExternalApis: boolean
  private chatClient!: ChatClient

  constructor (deps: Deps) {
    super()
    this.twurkpleAuthProvider = deps.resolve('twurpleAuthProvider')
    this.logService = deps.resolve('logService')
    this.logContext = createLogContext(this.logService, this)
    this.disableExternalApis = deps.resolve('disableExternalApis')
  }

  override async initialise (): Promise<void> {
    if (this.disableExternalApis) {
      return
    }

    this.chatClient = new ChatClient({
      authProvider: this.twurkpleAuthProvider.getUserTokenAuthProvider(),
      isAlwaysMod: false, // can't guarantee that streamers will mod the client, so err on the safe side
      readOnly: false,

      // inject custom logging
      logger: {
        custom: {
          log: (level: LogLevel, message: string) => onTwurpleClientLog(this.logContext, level, message)
        }
      }
    })

    await this.chatClient.connect()

    this.logService.logInfo(this, 'Successfully connected to the Twurple chat client')
  }

  override dispose (): void {
    this.chatClient.quit()

    this.logService.logInfo(this, 'Disconnected from the Twurple chat client')
  }

  get () {
    return this.chatClient
  }
}
