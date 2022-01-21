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

  public logApiRequest (logger: ILoggable, requestId: number, request: string, params: Record<string, any> | null) {
    let stringifiedParams = params ? ` with params: ${JSON.stringify(params)}` : ''
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
    const prefix = `${formatTime()} ${logType.toUpperCase()} > [${logger.name}]`
    if (!(logType === 'api' || logType === 'debug')) {
      // don't print api or debug logs to the console as they are very verbose
      const consoleLogger = logType === 'error' ? console.error
        : logType === 'warning' ? console.warn
        : logType === 'info' ? console.info
        : console.debug
      consoleLogger(prefix, ...args)
    }

    const content = args.map(a => JSON.stringify(a) ?? 'undefined').join(' ')
    const message = `${prefix} ${content}`
    this.fileService.writeLine(this.logFile, message, { append: true })
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
