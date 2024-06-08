import { RankName, RegisteredUser } from '@prisma/client'
import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import ApiService from '@rebel/server/controllers/ApiService'
import LogService from '@rebel/server/services/LogService'
import { LogContext, createLogContext } from '@rebel/shared/ILogService'
import { ApiResponse, API_ERRORS, ErrorCode, ResponseData, ApiResponseData } from '@rebel/api-models/types'
import { Schema, SchemaType, validateObject } from '@rebel/server/controllers/schema'

export const BASE_PATH = '/api'

export function buildPath (...pathParts: string[]) {
  return BASE_PATH + pathParts.map(p => '/' + p).join()
}

type RequestInfo = {
  // always null if the endpoint doesn't require authentication
  username: string | null

  // always null if the endpoint doesn't require a streamer context
  streamerId: number | null
  ip: string
}

/** Utility type that defines the shape any endpoint implementation methods should have. */
export type Endpoint<Args, T extends ApiResponse<any>> = (args: Args & { builder: ResponseBuilder<ApiResponseData<T>> }) => Promise<T>

/** The input argument for an endpoint implementation method. */
export type In<E extends Endpoint<any, any>> = Parameters<E>['0']

/** The output arguemnt for an endpoint implementation method. */
export type Out<E extends Endpoint<any, any>> = ReturnType<E>

export type ErrorType = Error | string

export type ControllerDependencies<T> = Dependencies<T & {
  logService: LogService
  apiService: ApiService
}>

type Deps = Dependencies<{
  apiService: ApiService
  logService: LogService
}>

export abstract class ControllerBase extends ContextClass {
  readonly name: string
  protected readonly logService: LogService
  protected readonly logContext: LogContext
  protected readonly apiService: ApiService

  constructor (deps: Deps, controllerName: string) {
    super()
    this.name = controllerName
    this.logService = deps.resolve('logService')
    this.logContext = createLogContext(this.logService, this)
    this.apiService = deps.resolve('apiService')
  }

  // the `ControllerBase` acts as a proxy so we don't have to do `super.apiService.getCurrentUser` but just `super.getCurrentUser`
  protected getCurrentUser (optional?: false): RegisteredUser
  protected getCurrentUser (optional: true): RegisteredUser | null
  protected getCurrentUser (optional?: boolean): RegisteredUser | null {
    return this.apiService.getCurrentUser(optional as any)
  }

  protected getStreamerId (optional?: false): number
  protected getStreamerId (optional: true): number | null
  protected getStreamerId (optional?: boolean): number | null {
    return this.apiService.getStreamerId(optional as any)
  }

  protected getRanks (): RankName[] | null {
    return this.apiService.getRanks()
  }

  protected hasRankOrAbove (rank: RankName): boolean {
    return this.apiService.hasRankOrAbove(rank)
  }

  protected registerResponseBuilder<
    R extends ApiResponse<T>,
    T extends ResponseData<T> = Extract<R, { success: true }>['data'] // wow!
  > (endpointName: string): ResponseBuilder<T> {
    return new ResponseBuilder(this.logContext, endpointName, this.apiService)
  }
}

export class ResponseBuilder<T extends ResponseData<T>> {
  private readonly logContext: LogContext
  private readonly endpointName: string
  private readonly apiService: ApiService
  private readonly start: number

  constructor (logContext: LogContext, endpointName: string, apiService: ApiService) {
    this.logContext = logContext
    this.endpointName = endpointName
    this.apiService = apiService
    this.start = new Date().getTime()
  }

  public success (data: T): ApiResponse<T> {
    this.logContext.logDebug(`Endpoint ${this.endpointName} processed the request successfully after ${this.getDuration()} ms.`, this.getRequestInfo())

    return {
      success: true,
      timestamp: new Date().getTime(),
      data
    } as ApiResponse<T> // i don't understand why we need to cast lol
  }

  public failure (error: ErrorType): ApiResponse<any>
  public failure (errorCode: ErrorCode, error: ErrorType): ApiResponse<any>
  public failure (arg1: ErrorCode | ErrorType, arg2?: ErrorType): ApiResponse<any> {
    const errorCode: ErrorCode = typeof arg1 === 'number' ? arg1 : 500
    const error = this.getErrorObject(typeof arg1 === 'number' ? arg2! : arg1)

    this.logContext.logError(`Endpoint ${this.endpointName} encountered a ${errorCode} error after ${this.getDuration()} ms:`, error, this.getRequestInfo())

    return {
      success: false,
      timestamp: new Date().getTime(),
      error: {
        errorCode,
        errorType: API_ERRORS[errorCode],
        internalErrorType: error.type ?? 'Error',
        message: error.message
      }
    }
  }

  public validateInput<S extends Schema> (schema: S, input: SchemaType<S>): Extract<ApiResponse<any>, { success: false }> | null {
    try {
      const invalidInputs = validateObject(schema, input)
      if (invalidInputs.length === 0) {
        return null
      } else {
        return {
          success: false,
          timestamp: new Date().getTime(),
          error: {
            errorCode: 400,
            errorType: API_ERRORS[400],
            internalErrorType: 'Error',
            message: `The following inputs are invalid: ${invalidInputs.map(x => x.stringify()).join(', ')}`
          }
        }
      }
    } catch (e: any) {
      this.logContext.logError('Failed to validate inputs', e)
      return {
        success: false,
        timestamp: new Date().getTime(),
        error: {
          errorCode: 500,
          errorType: API_ERRORS[500],
          internalErrorType: 'Error',
          message: `Failed to validate inputs: ${e.message}`
        }
      }
    }
  }

  private getErrorObject (error: ErrorType): { message: string, type?: string, stack?: string } {
    if (typeof error === 'string') {
      return { message: error }
    } else if (error instanceof Error) {
      // for some reason we can't directly stringify the error object - it just returns a string of an empty object
      // so copy its properties
      return { message: error.message, stack: error.stack, type: error.constructor.name }
    } else {
      return { message: 'CANNOT CONVERT ERROR TO STRING' }
    }
  }

  private getDuration (): number {
    return new Date().getTime() - this.start
  }

  private getRequestInfo (): RequestInfo {
    return {
      username: this.apiService.getCurrentUser(true)?.username ?? null,
      streamerId: this.apiService.getStreamerId(true) ?? null,
      ip: this.apiService.getRequest().ip
    }
  }
}
