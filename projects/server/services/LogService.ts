import { Dependencies } from '@rebel/server/context/context'
import { NodeEnv } from '@rebel/server/globals'
import { ILoggable } from '@rebel/server/interfaces'
import FileService from '@rebel/server/services/FileService'
import { formatDate, formatTime } from '@rebel/server/util/datetime'

type LogType = 'info' | 'api' | 'debug' | 'warning' | 'error'

type Deps = Dependencies<{
  liveId: string
  isLive: boolean
  fileService: FileService
}>

export default class LogService {
  private readonly liveId: string
  private readonly isLive: boolean
  private readonly fileService: FileService
  private readonly logFile: string

  constructor (deps: Deps) {
    this.liveId = deps.resolve('liveId')
    this.isLive = deps.resolve('isLive')
    this.fileService = deps.resolve('fileService')

    const existingFile = this.fileService.getDataFiles().find(file => file.startsWith('log_') && file.includes(this.liveId))
    if (existingFile) {
      this.logFile = this.fileService.getDataFilePath(existingFile)
    } else {
      this.logFile = this.fileService.getDataFilePath(`log_${formatDate()}_${this.liveId}.txt`)
    }
  }

  public logDebug (logger: ILoggable, ...args: any[]) {
    this.log(logger, 'debug', args)
  }

  public logInfo (logger: ILoggable, ...args: any[]) {
    this.log(logger, 'info', args)
  }

  public logApi (logger: ILoggable, request: string, params: Record<string, any> | null, response: any) {
    let stringifiedParams = params ? ` with params: ${JSON.stringify(params)}` : ''
    this.log(logger, 'api',  [`API request '${request}'${stringifiedParams} received response`, response])
  }

  public logWarning (logger: ILoggable, ...args: any[]) {
    this.log(logger, 'warning', args)
  }

  public logError (logger: ILoggable, ...args: any[]) {
    this.log(logger, 'error', args)
  }

  private log (logger: ILoggable, logType: LogType, args: any[]) {
    const prefix = `${formatTime()} ${logType.toUpperCase()} > [${logger.name}]`
    if (!(logType === 'api' || logType === 'debug')) {
      // don't print api or debug logs to the console as they are very verbose
      const consoleLogger = logType === 'error' ? console.error
        : logType === 'warning' ? console.warn
        : logType === 'info' ? console.info
        : console.debug
      consoleLogger(prefix, ...args)
    }

    // convert the args to strings, stripping away the `"` that are created along the way
    const content = args.map(a => { const str = JSON.stringify(a) ?? 'undefined'; return str.substring(1, str.length - 1) }).join(' ')
    const message = `${prefix} ${content}`
    this.fileService.writeLine(this.logFile, message, { append: true })
  }
}

export type LogContext = {
  logDebug: (...args: any[]) => void
  logInfo: (...args: any[]) => void
  logApi: (request: string, params: Record<string, any> | null, response: any) => void
  logWarning: (...args: any[]) => void
  logError: (...args: any[]) => void
}

export function createLogContext (logService: LogService, logger: ILoggable): LogContext {
  return {
    logDebug: (...args: any[]) => logService.logDebug(logger, ...args),
    logInfo: (...args: any[]) => logService.logInfo(logger, ...args),
    logApi: (request: string, params: Record<string, any> | null, response: any) => logService.logApi(logger, request, params, response),
    logWarning: (...args: any[]) => logService.logWarning(logger, ...args),
    logError: (...args: any[]) => logService.logError(logger, ...args)
  }
}
