import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import LogService, { onTwurpleClientLog } from '@rebel/server/services/LogService'
import { ChatClient, LogLevel } from '@twurple/chat'
import { LogContext, createLogContext } from '@rebel/shared/ILogService'

type Deps = Dependencies<{
  twurpleAuthProvider: TwurpleAuthProvider
  logService: LogService
  disableExternalApis: boolean
  isAdministrativeMode: () => boolean
}>

export default class TwurpleChatClientProvider extends ContextClass {
  readonly name = TwurpleChatClientProvider.name

  private readonly twurkpleAuthProvider: TwurpleAuthProvider
  private readonly logService: LogService
  private readonly logContext: LogContext
  private readonly disableExternalApis: boolean
  private readonly isAdministrativeMode: () => boolean
  private chatClient!: ChatClient

  constructor (deps: Deps) {
    super()
    this.twurkpleAuthProvider = deps.resolve('twurpleAuthProvider')
    this.logService = deps.resolve('logService')
    this.logContext = createLogContext(this.logService, this)
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.isAdministrativeMode = deps.resolve('isAdministrativeMode')
  }

  override initialise (): void {
    if (this.disableExternalApis) {
      return
    } else if (this.isAdministrativeMode()) {
      this.logService.logInfo(this, 'Skipping initialisation because we are in administrative mode.')
      return
    }

    this.chatClient = new ChatClient({
      authProvider: this.twurkpleAuthProvider.getUserTokenAuthProviderForAdmin(),
      isAlwaysMod: false, // can't guarantee that streamers will mod the client, so err on the safe side
      readOnly: false,

      // inject custom logging
      logger: {
        custom: {
          log: (level: LogLevel, message: string) => onTwurpleClientLog(this.logContext, level, message)
        }
      }
    })

    this.logService.logInfo(this, 'Successfully connected to the Twurple chat client')
  }

  public override onReady (): void {
    void this.chatClient.connect()
  }

  override dispose (): void {
    this.chatClient.quit()

    this.logService.logInfo(this, 'Disconnected from the Twurple chat client')
  }

  get () {
    return this.chatClient
  }
}
