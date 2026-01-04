import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider from '@rebel/server/providers/DbProvider'
import FileService from '@rebel/server/services/FileService'
import { deconstructDate, formatDate, formatTime } from '@rebel/shared/util/datetime'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import { LogLevel as TwurpleLogLevel } from '@twurple/chat'
import ILogService, { ILoggable, LogContext } from '@rebel/shared/ILogService'
import { Prisma } from '@prisma/client'
import { LogLevel, LogOutput } from '@rebel/server/globals'
import MonitoringService from '@rebel/server/services/MonitoringService'

type LogType = 'debug' | 'info' | 'warning' | 'error'

type LoggerType = 'db' | 'api' | 'standard'

type Deps = Dependencies<{
  fileService: FileService
  dbLogLevel: LogLevel
  apiLogLevel: LogLevel
  debugLogOutput: LogOutput
  infoLogOutput: LogOutput
  warningLogOutput: LogOutput
  errorLogOutput: LogOutput
  monitoringService: MonitoringService
}>

export default class LogService extends ContextClass implements ILogService {
  private readonly fileService: FileService
  private readonly dbLogLevel: LogLevel
  private readonly apiLogLevel: LogLevel
  private readonly debugLogOutput: LogOutput
  private readonly infoLogOutput: LogOutput
  private readonly warningLogOutput: LogOutput
  private readonly errorLogOutput: LogOutput
  private readonly monitoringService: MonitoringService

  constructor (deps: Deps) {
    super()
    this.fileService = deps.resolve('fileService')
    this.dbLogLevel = deps.resolve('dbLogLevel')
    this.apiLogLevel = deps.resolve('apiLogLevel')
    this.debugLogOutput = deps.resolve('debugLogOutput')
    this.infoLogOutput = deps.resolve('infoLogOutput')
    this.warningLogOutput = deps.resolve('warningLogOutput')
    this.errorLogOutput = deps.resolve('errorLogOutput')
    this.monitoringService = deps.resolve('monitoringService')
  }

  public logDebug (logger: ILoggable, ...args: any[]) {
    this.log(getLoggerType(logger), logger, 'debug', args)
  }

  public logInfo (logger: ILoggable, ...args: any[]) {
    this.log(getLoggerType(logger), logger, 'info', args)
  }

  public logApiRequest (logger: ILoggable, requestId: number, request: string, params: Record<string, any> | null) {
    const stringifiedParams = params ? ` with params: ${JSON.stringify(params)}` : ''
    this.log('api', logger, 'debug',  [`Id #${requestId}`, `API request '${request}'${stringifiedParams} dispatched`])
  }

  public logApiResponse (logger: ILoggable, requestId: number, error: boolean, response: any) {
    this.log('api', logger, error ? 'error' : 'debug',  [`Id #${requestId}`, error ? 'failed' : 'succeeded', 'with response', response])
  }

  public logWarning (logger: ILoggable, ...args: any[]) {
    this.log(getLoggerType(logger), logger, 'warning', args)
  }

  public logError (logger: ILoggable, ...args: any[]) {
    this.log(getLoggerType(logger), logger, 'error', args)
  }

  public logSlowQuery (durationMs: number, params: Prisma.MiddlewareParams) {
    const prefix = `${formatTime()} (${durationMs} ms) >`
    const content = stringifyArgs([params])
    const message = `${prefix} ${content}`

    try {
      this.fileService.writeLine(this.getSlowQueryLogFile(), message, { append: true })
    } catch (e: any) {
      console.error('LogService encountered an error while logging a slow query:', e)
      this.monitoringService.trackException(['LogService failed to log a slow query message.', message, e])
    }
  }

  private log (loggerType: LoggerType, logger: ILoggable, logType: LogType, args: any[]) {
    const action = this.getAction(loggerType, logType)
    if (action === 'disable') {
      return
    }

    const prefix = `${formatTime()} ${logType.toUpperCase()} > [${logger.name}]`
    if (action === 'full') {
      // don't print api or debug logs to the console as they are very verbose
      const consoleLogger = logType === 'error' ? console.error
        : logType === 'warning' ? console.warn
        : logType === 'info' ? console.info
        : console.debug
      consoleLogger(prefix, ...args)
    }

    const content = stringifyArgs(args)
    const message = `${prefix} ${content}`

    try {
      if (logType === 'error') {
        this.monitoringService.trackException(args)
      }

      this.fileService.writeLine(this.getLogFile(), message, { append: true })
    } catch (e: any) {
      console.error('LogService encountered an error:', e)
      this.monitoringService.trackException(['LogService failed to log a message.', message, e])
    }
  }

  /** Given the logger and type of log message, how should we log it? */
  getAction (loggerType: LoggerType, logType: LogType): LogOutput {
    if (loggerType === 'db') {
      if (!shouldLog(logType, this.dbLogLevel)) {
        return 'disable'
      }
    } else if (loggerType === 'api') {
      if (!shouldLog(logType, this.apiLogLevel)) {
        return 'disable'
      }
    } else if (loggerType !== 'standard') {
      assertUnreachable(loggerType)
    }

    if (logType === 'debug') {
      return this.debugLogOutput
    } else if (logType === 'info') {
      return this.infoLogOutput
    } else if (logType === 'warning') {
      return this.warningLogOutput
    } else if (logType === 'error') {
      return this.errorLogOutput
    } else {
      assertUnreachable(logType)
    }
  }

  // automatically write to a new file every hour so they don't get too large
  private getLogFile () {
    const { hours } = deconstructDate(new Date(), false)
    return this.fileService.getDataFilePath(`log_${formatDate()}_${String(hours).padStart(2, '0')}.txt`)
  }

  private getSlowQueryLogFile () {
    const { hours } = deconstructDate(new Date(), false)
    return this.fileService.getDataFilePath('slow-query', `slow_query_${formatDate()}_${String(hours).padStart(2, '0')}.txt`)
  }
}

export function onTwurpleClientLog (context: LogContext, level: TwurpleLogLevel, message: string): void {
  message = `[Relayed from Twurple] ${message}`

  switch (level) {
    case TwurpleLogLevel.CRITICAL:
      // error so we can print the stack trace
      context.logError('[CRITICAL]', new Error(message))
      break
    case TwurpleLogLevel.ERROR:
      context.logError('[ERROR]', new Error(message))
      break
    case TwurpleLogLevel.WARNING:
      context.logWarning('[WARNING]', message)
      break
    case TwurpleLogLevel.INFO:
      context.logInfo('[INFO]', message)
      break
    case TwurpleLogLevel.DEBUG:
      context.logDebug('[DEBUG]', message)
      break
    case TwurpleLogLevel.TRACE:
      // don't log - trace events are extremely verbose and not helpful to us
      break
    default:
      assertUnreachable(level)
  }
}

function stringifyArgs (args: any[]): string {
  return args.map(a => {
    try {
      if (typeof a === 'string') {
        return a
      } else if (a instanceof Error) {
        return `{ name: ${a.name}, message: ${a.message}, stack: ${a.stack} }`
      } else {
        return JSON.stringify(a) ?? 'undefined'
      }
    } catch (e: any) {
      const type = a?.constructor?.name ?? 'Unknown'
      return `<<LogService: Unable to stringify object of type ${type}: ${e.message}>>`
    }
  }).join(' ')
}

function getLoggerType (logger: ILoggable): LoggerType {
  if (logger.name === DbProvider.name) {
    return 'db'
  } else {
    return 'standard'
  }
}

function shouldLog (type: LogType, level: LogLevel): boolean {
  if (level === 'full') {
    return true
  } else if (level === 'disable') {
    return false
  }

  if (type === 'debug') {
    return false
  } else if (type === 'info') {
    if (level === 'info' || level === 'warning' || level === 'error') {
      return true
    } else {
      assertUnreachable(level)
    }
  } else if (type === 'warning') {
    if (level === 'info') {
      return false
    } else if (level === 'warning' || level === 'error') {
      return true
    } else {
      assertUnreachable(level)
    }
  } else if (type === 'error') {
    if (level === 'info' || level === 'warning') {
      return false
    } else if (level === 'error') {
      return true
    } else {
      assertUnreachable(level)
    }
  } else {
    assertUnreachable(type)
  }
}
