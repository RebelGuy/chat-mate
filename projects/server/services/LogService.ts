import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import DbProvider from '@rebel/server/providers/DbProvider'
import ApplicationInsightsService from '@rebel/server/services/ApplicationInsightsService'
import FileService from '@rebel/server/services/FileService'
import { deconstructDate, formatDate, formatTime } from '@rebel/shared/util/datetime'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import { LogLevel } from '@twurple/chat'
import ILogService, { ILoggable, LogContext } from '@rebel/shared/ILogService'

type LogType = 'info' | 'api' | 'debug' | 'warning' | 'error'

type Deps = Dependencies<{
  fileService: FileService
  applicationInsightsService: ApplicationInsightsService
  enableDbLogging: boolean
}>

export default class LogService extends ContextClass implements ILogService {
  private readonly fileService: FileService
  private readonly applicationInsightsService: ApplicationInsightsService
  private readonly enableDbLogging: boolean

  constructor (deps: Deps) {
    super()
    this.fileService = deps.resolve('fileService')
    this.applicationInsightsService = deps.resolve('applicationInsightsService')
    this.enableDbLogging = deps.resolve('enableDbLogging')
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
    if (!this.enableDbLogging && logger.name === DbProvider.name && logType === 'debug') {
      return
    }

    const isVerbose = logType === 'api' || logType === 'debug'
    const prefix = `${formatTime()} ${logType.toUpperCase()} > [${logger.name}]`
    if (!isVerbose) {
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
    const message = `${prefix} ${content}`

    try {
      if (logType === 'error') {
        this.applicationInsightsService.trackException(args)
      }

      this.fileService.writeLine(this.getLogFile(), message, { append: true })

      if (!isVerbose) {
        this.applicationInsightsService.trackTrace(logType, message)
      }
    } catch (e: any) {
      console.error('LogService encountered an error:', e)
    }
  }

  // automatically write to a new file every day so they don't get too large
  private getLogFile () {
    const { hours } = deconstructDate(new Date(), false)
    return this.fileService.getDataFilePath(`log_${formatDate()}_${String(hours).padStart(2, '0')}.txt`)
  }
}

export function onTwurpleClientLog (context: LogContext, level: LogLevel, message: string): void {
  message = `[Relayed from Twurple] ${message}`

  switch (level) {
    case LogLevel.CRITICAL:
      // error so we can print the stack trace
      context.logError('[CRITICAL]', new Error(message))
      break
    case LogLevel.ERROR:
      context.logError('[ERROR]', new Error(message))
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
      // don't log - trace events are extremely verbose and not helpful to us
      break
    default:
      assertUnreachable(level)
  }
}
