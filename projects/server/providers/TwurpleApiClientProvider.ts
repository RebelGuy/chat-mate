import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import IProvider from '@rebel/server/providers/IProvider'
import TwurpleAuthProvider from '@rebel/server/providers/TwurpleAuthProvider'
import LogService, { createLogContext, LogContext, onTwurpleClientLog } from '@rebel/server/services/LogService'
import { ApiClient } from '@twurple/api'
import { LogLevel } from '@twurple/chat'

type Deps = Dependencies<{
  disableExternalApis: boolean
  twurpleAuthProvider: TwurpleAuthProvider
  logService: LogService
}>

export default class TwurpleApiClientProvider extends ContextClass implements IProvider<ApiClient> {
  public readonly name = TwurpleApiClientProvider.name

  private readonly disableExternalApis: boolean
  private readonly twurpleAuthProvider: TwurpleAuthProvider
  private readonly logService: LogService
  private readonly logContext: LogContext
  private apiClient!: ApiClient
  private clientApiClient!: ApiClient

  constructor (deps: Deps) {
    super()
  
    this.disableExternalApis = deps.resolve('disableExternalApis')
    this.twurpleAuthProvider = deps.resolve('twurpleAuthProvider')
    this.logService = deps.resolve('logService')
    this.logContext = createLogContext(this.logService, this)
  }

  public override initialise () {
    if (this.disableExternalApis) {
      return
    }

    this.apiClient = new ApiClient({
      authProvider: this.twurpleAuthProvider.get(),
      
      // inject custom logging
      logger: {
        custom: {
          log: (level: LogLevel, message: string) => onTwurpleClientLog(this.logContext, level, message)
        }
      }
    })

    this.clientApiClient = new ApiClient({
      authProvider: this.twurpleAuthProvider.getClientAuthProvider(),
            
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
