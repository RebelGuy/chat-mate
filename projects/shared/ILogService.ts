import { NO_OP } from '@rebel/shared/util/typescript'

export default interface ILogService {
  logDebug (logger: ILoggable, ...args: any[]): void
  logInfo (logger: ILoggable, ...args: any[]): void
  logApiRequest (logger: ILoggable, requestId: number, request: string, params: Record<string, any> | null): void
  logApiResponse (logger: ILoggable, requestId: number, error: boolean, response: any): void
  logWarning (logger: ILoggable, ...args: any[]): void
  logError (logger: ILoggable, ...args: any[]): void
}

export interface ILoggable {
  readonly name: string
}

export type LogContext = {
  [K in keyof ILogService]: ILogService[K] extends (logger: ILoggable, ...rest: infer Rest) => void ? (...rest: Rest) => void : never
}

/** Creates an anonymous logService. */
export function createLogContext (logService: ILogService, logger: ILoggable): LogContext {
  return {
    logDebug: (...args: any[]) => logService.logDebug(logger, ...args),
    logInfo: (...args: any[]) => logService.logInfo(logger, ...args),
    logApiRequest: (requestId: number, request: string, params: Record<string, any> | null) => logService.logApiRequest(logger, requestId, request, params),
    logApiResponse: (requestId: number, error: boolean, response: any) => logService.logApiResponse(logger, requestId, error, response),
    logWarning: (...args: any[]) => logService.logWarning(logger, ...args),
    logError: (...args: any[]) => logService.logError(logger, ...args)
  }
}

export function createEmptyLogContext (): LogContext {
  return {
    logDebug: NO_OP,
    logInfo: NO_OP,
    logApiRequest: NO_OP,
    logApiResponse: NO_OP,
    logWarning: NO_OP,
    logError: NO_OP
  }
}
