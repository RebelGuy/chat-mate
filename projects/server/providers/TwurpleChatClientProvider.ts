import { Dependencies } from '@rebel/shared/context/context'
import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import LogService, { onTwurpleClientLog } from '@rebel/server/services/LogService'
import { ChatClient, LogLevel } from '@twurple/chat'
import { LogContext, createLogContext } from '@rebel/shared/ILogService'
import TimerHelpers from '@rebel/server/helpers/TimerHelpers'

type Deps = Dependencies<{
  twurpleAuthProvider: TwurpleAuthProvider
  logService: LogService
  disableExternalApis: boolean
  timerHelpers: TimerHelpers
  isAdministrativeMode: () => boolean
}>

export default class TwurpleChatClientProvider extends SingletonContextClass {
  readonly name = TwurpleChatClientProvider.name

  private readonly twurkpleAuthProvider: TwurpleAuthProvider
  private readonly logService: LogService
  private readonly logContext: LogContext
  private readonly disableExternalApis: boolean
  private readonly timerHelpers: TimerHelpers
  private readonly isAdministrativeMode: () => boolean
  private chatClient!: ChatClient

  private disconnects = 0

  constructor (deps: Deps) {
    super()
    this.twurkpleAuthProvider = deps.resolve('twurpleAuthProvider')
    this.logService = deps.resolve('logService')
    this.logContext = createLogContext(this.logService, this)
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.timerHelpers = deps.resolve('timerHelpers')
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
  }

  public override onReady (): void {
    if (this.isAdministrativeMode()) {
      this.logService.logInfo(this, 'Skipping onReady action because we are in administrative mode.')
      return
    }

    this.logService.logInfo(this, 'Initiating connection to the Twurple chat client')

    void this.chatClient.connect()
    this.timerHelpers.setInterval(() => this.onCheckHealth(), 10_000)
  }

  get () {
    return this.chatClient
  }

  private async onCheckHealth () {
    if (this.chatClient.isConnected) {
      this.disconnects = 0
    } else {
      this.disconnects++

      if (this.disconnects >= 3) {
        this.logService.logError(this, 'Detected that the ChatClient was disconnected for at least the last 3 intervals. Reconnecting.')
        try {
          await this.chatClient.reconnect()
        } catch (e: any) {
          this.logService.logError(this, 'Failed to reconnect to the ChatClient:', e)
        }

        this.disconnects = 0
      }
    }
  }
}
