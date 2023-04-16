import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import IProvider from '@rebel/server/providers/IProvider'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import LogService, { onTwurpleClientLog } from '@rebel/server/services/LogService'
import { ApiClient } from '@twurple/api'
import { LogLevel } from '@twurple/chat'
import { LogContext, createLogContext } from '@rebel/shared/ILogService'

type Deps = Dependencies<{
  disableExternalApis: boolean
  twurpleAuthProvider: TwurpleAuthProvider
  logService: LogService
  isAdministrativeMode: () => boolean
}>

export default class TwurpleApiClientProvider extends ContextClass {
  public readonly name = TwurpleApiClientProvider.name

  private readonly disableExternalApis: boolean
  private readonly twurpleAuthProvider: TwurpleAuthProvider
  private readonly logService: LogService
  private readonly logContext: LogContext
  private readonly isAdministrativeMode: () => boolean
  private apiClient!: ApiClient
  private clientApiClient!: ApiClient

  constructor (deps: Deps) {
    super()

    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.twurpleAuthProvider = deps.resolve('twurpleAuthProvider')
    this.logService = deps.resolve('logService')
    this.isAdministrativeMode = deps.resolve('isAdministrativeMode')
    this.logContext = createLogContext(this.logService, this)
  }

  public override initialise () {
    if (this.disableExternalApis) {
      return
    } else if (this.isAdministrativeMode()) {
      this.logService.logInfo(this, 'Skipping initialisation because we are in administrative mode.')
      return
    }

    this.apiClient = new ApiClient({
      authProvider: this.twurpleAuthProvider.getUserTokenAuthProvider(),

      // inject custom logging
      logger: {
        custom: {
          log: (level: LogLevel, message: string) => onTwurpleClientLog(this.logContext, level, message)
        }
      }
    })

    this.clientApiClient = new ApiClient({
      authProvider: this.twurpleAuthProvider.getAppTokenAuthProvider(),

      // inject custom logging
      logger: {
        custom: {
          log: (level: LogLevel, message: string) => onTwurpleClientLog(this.logContext, level, message)
        }
      }
    })
  }

  /** This is probably the one you want. */
  public get () {
    return this.apiClient
  }

  public getClientApi () {
    return this.clientApiClient
  }
}
