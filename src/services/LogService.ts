import { Dependencies } from '@rebel/context/context'
import { NodeEnv } from '@rebel/globals'
import { ILoggable } from '@rebel/interfaces'
import FileService from '@rebel/services/FileService'
import { formatDate, formatTime } from '@rebel/util/datetime'

type LogType = 'info' | 'debug' | 'warning' | 'error'

export default class LogService {
  private readonly liveId: string
  private readonly isLive: boolean
  private readonly fileService: FileService
  private readonly logFile: string

  constructor (deps: Dependencies) {
    this.liveId = deps.resolve<string>('liveId')
    this.isLive = deps.resolve<boolean>('isLive')
    this.fileService = deps.resolve<FileService>(FileService.name)

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

  public logWarning (logger: ILoggable, ...args: any[]) {
    this.log(logger, 'warning', args)
  }

  public logError (logger: ILoggable, ...args: any[]) {
    this.log(logger, 'error', args)
  }

  private log (logger: ILoggable, logType: LogType, args: any[]) {
    if (this.isLive && logType === 'debug') {
      return
    }

    const prefix = `${formatTime()} ${logType.toUpperCase()} > [${logger.name}]`
    const consoleLogger = logType === 'error' ? console.error
      : logType === 'warning' ? console.warn
      : logType === 'info' ? console.info
      : console.debug
    consoleLogger(prefix, ...args)

    // convert the args to strings, stripping away the `"` that are created along the way
    const content = args.map(a => { const str = JSON.stringify(a); return str.substring(1, str.length - 1) }).join(' ')
    const message = `${prefix} ${content}`
    this.fileService.writeLine(this.logFile, message, { append: true })
  }
}

export type LogContext = {
  logDebug: (...args: any[]) => void
  logInfo: (...args: any[]) => void
  logWarning: (...args: any[]) => void
  logError: (...args: any[]) => void
}

export function createLogContext (logService: LogService, logger: ILoggable): LogContext {
  return {
    logDebug: (...args: any[]) => logService.logDebug(logger, ...args),
    logInfo: (...args: any[]) => logService.logInfo(logger, ...args),
    logWarning: (...args: any[]) => logService.logWarning(logger, ...args),
    logError: (...args: any[]) => logService.logError(logger, ...args)
  }
}