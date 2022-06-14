import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import { NodeEnv } from '@rebel/server/globals'
import { ILoggable } from '@rebel/server/interfaces'
import DbProvider from '@rebel/server/providers/DbProvider'
import ApplicationInsightsService from '@rebel/server/services/ApplicationInsightsService'
import FileService from '@rebel/server/services/FileService'
import { formatDate, formatTime } from '@rebel/server/util/datetime'
import { assertUnreachable } from '@rebel/server/util/typescript'
import { LogLevel } from '@twurple/chat'

type LogType = 'info' | 'api' | 'debug' | 'warning' | 'error'

type Deps = Dependencies<{
  isLocal: boolean
  fileService: FileService
  applicationInsightsService: ApplicationInsightsService
  enableDbLogging: boolean
}>

export default class LogService extends ContextClass {
  private readonly fileService: FileService
  private readonly applicationInsightsService: ApplicationInsightsService
  private readonly enableDbLogging: boolean
  private readonly logFile: string | null

  constructor (deps: Deps) {
    super()
    this.fileService = deps.resolve('fileService')
    this.applicationInsightsService = deps.resolve('applicationInsightsService')
    this.enableDbLogging = deps.resolve('enableDbLogging')
    this.logFile = deps.resolve('isLocal') ? this.fileService.getDataFilePath(`log_${formatDate()}.txt`) : null
  }

  public logDebug (logger: ILoggable, ...args: any[]) {
    this.log(logger, 'debug', args)
  }

  public logInfo (logger: ILoggable, ...args: any[]) {
    this.log(logger, 'info', args)
  }

  public logApiRequest (logger: ILoggable, requestId: number, request: string, params: Record<string, any> | null) {
    const stringifiedParams = params ? ` with params: ${JSON.stringify(params)}` : ''
    this.log(logger, 'api',  [`Id #${requestId}`, `API request '${request}'${stringifiedParams} dispatched`])
  }

  public logApiResponse (logger: ILoggable, requestId: number, error: boolean, response: any) {
    this.log(logger, 'api',  [`Id #${requestId}`, error ? 'failed' : 'succeeded', 'with response', response])
  }

  public logWarning (logger: ILoggable, ...args: any[]) {
    this.log(logger, 'warning', args)
  }

  public logError (logger: ILoggable, ...args: any[]) {
    this.log(logger, 'error', args)
  }

  private log (logger: ILoggable, logType: LogType, args: any[]) {
    if (!this.enableDbLogging && logger.name === DbProvider.name && (logType === 'debug' || logType === 'info')) {
      return
    }

    const prefix = `${formatTime()} ${logType.toUpperCase()} > [${logger.name}]`
    if (!(logType === 'api' || logType === 'debug')) {
      // don't print api or debug logs to the console as they are very verbose
      const consoleLogger = logType === 'error' ? console.error
        : logType === 'warning' ? console.warn
        : logType === 'info' ? console.info
        : console.debug
      consoleLogger(prefix, ...args)
    }

    const content = args.map(a => {
      try {
        if (typeof a === 'string') {
          return a
        } else {
          return JSON.stringify(a) ?? 'undefined'
        }
      } catch (e: any) {
        const type = a?.constructor?.name ?? 'Unknown'
        return `<<LogService: Unable to stringify object of type ${type}: ${e.message}>>`
      }
    }).join(' ')
    const message = `${prefix} ${content}`

    if (logType === 'error') {
      this.applicationInsightsService.trackException(args)
    }

    if (this.logFile != null) {
      this.fileService.writeLine(this.logFile, message, { append: true })
    }
  }
}

export type LogContext = {
  logDebug: (...args: any[]) => void
  logInfo: (...args: any[]) => void
  logApiRequest: (requestId: number, request: string, params: Record<string, any> | null) => void
  logApiResponse: (requestId: number, error: boolean, response: any) => void
  logWarning: (...args: any[]) => void
  logError: (...args: any[]) => void
}

export function createLogContext (logService: LogService, logger: ILoggable): LogContext {
  return {
    logDebug: (...args: any[]) => logService.logDebug(logger, ...args),
    logInfo: (...args: any[]) => logService.logInfo(logger, ...args),
    logApiRequest: (requestId: number, request: string, params: Record<string, any> | null) => logService.logApiRequest(logger, requestId, request, params),
    logApiResponse: (requestId: number, error: boolean, response: any) => logService.logApiResponse(logger, requestId, error, response),
    logWarning: (...args: any[]) => logService.logWarning(logger, ...args),
    logError: (...args: any[]) => logService.logError(logger, ...args)
  }
}

export function onTwurpleClientLog (context: LogContext, level: LogLevel, message: string): void {
  switch (level) {
    case LogLevel.CRITICAL:
      context.logError('[CRITICAL]', message)
      break
    case LogLevel.ERROR:
      context.logError('[ERROR]', message)
      break
    case LogLevel.WARNING:
      context.logWarning('[WARNING]', message)
      break
    case LogLevel.INFO:
      context.logInfo('[INFO]', message)
      break
    case LogLevel.DEBUG:
      context.logDebug('[DEBUG]', message)
      break
    case LogLevel.TRACE:
      context.logDebug('[TRACE]', message)
      break
    default:
      assertUnreachable(level)
  }
}
