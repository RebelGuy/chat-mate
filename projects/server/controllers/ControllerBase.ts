import { RankName, RegisteredUser } from '@prisma/client'
import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import ApiService from '@rebel/server/controllers/ApiService'
import LogService, { createLogContext, LogContext } from '@rebel/server/services/LogService'

export const BASE_PATH = '/api'

export function buildPath (...pathParts: string[]) {
  return BASE_PATH + pathParts.map(p => '/' + p).join()
}

export type ApiResponse<T extends ResponseData<T>> = {
  timestamp: number
} & ({
  success: true
  data: T
} | {
  success: false
  error: ApiError
})

export type ApiRequest<T extends PublicObject<T>> = T

/** The root of the response data must consist exclusively of primitives and PublicObjects. */
export type ResponseData<T extends ResponseData<T>> = {
  // Note: the `extends self` condition is useful so that we get compile errors - otherwise, our typing will just remove (`never`) ineligible properties from T.

  // each property must be one of the following types:
  [K in keyof T]
    // nullable primitive types
    : T[K] extends number | string | boolean | null ? T[K]

    // primitive arrays
    : T[K] extends number[] | string[] | boolean[] ? T[K]

    // nullable PulicObject types
    : T[K] extends PublicObject<infer PO> ? PO
    : T[K] extends PublicObject<infer PO> | null ? PO | null

    // arrays of PublicObject types
    : T[K] extends Array<infer ArrObj> ? (ArrObj extends PublicObject<infer PO> ? PO[] : never)

    // don't allow anything else
    : never
}

/** Public objects are containers for primitive values or other public objects. */
export type PublicObject<T extends ResponseData<T>> = ResponseData<T>

/** Extracts the `data` component from an `ApiResponse` object. */
export type ExtractedData<T extends ApiResponse<any>> = Extract<T, { success: true }>['data']

/** Utility type that defines the shape any endpoint implementation methods should have. */
export type Endpoint<Args, T extends ApiResponse<any>> = (args: Args & { builder: ResponseBuilder<ExtractedData<T>> }) => Promise<T>

/** The input argument for an endpoint implementation method. */
export type In<E extends Endpoint<any, any>> = Parameters<E>['0']

/** The output arguemnt for an endpoint implementation method. */
export type Out<E extends Endpoint<any, any>> = ReturnType<E>

const API_ERRORS = {
  500: 'Internal Error',
  400: 'Bad Request',
  401: 'Unauthorised',
  403: 'Forbidden',
  404: 'Not Found',
  422: 'Unprocessable Entity'
}

export type ErrorCode = keyof typeof API_ERRORS

export type ApiError = {
  message: string,
  errorCode: ErrorCode,
  errorType: string
}

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
    return new ResponseBuilder(this.logContext, endpointName)
  }
}

export class ResponseBuilder<T extends ResponseData<T>> {
  private readonly logContext: LogContext
  private readonly endpointName: string
  private readonly start: number

  constructor (logContext: LogContext, endpointName: string) {
    this.logContext = logContext
    this.endpointName = endpointName
    this.start = new Date().getTime()
  }

  public success (data: T): ApiResponse<T> {
    this.logContext.logDebug(`Endpoint ${this.endpointName} processed the request successfully after ${this.getDuration()} ms.`)

    return {
      success: true,
      timestamp: new Date().getTime(),
      data
    }
  }

  public failure (error: ErrorType): ApiResponse<any>
  public failure (errorCode: ErrorCode, error: ErrorType): ApiResponse<any>
  public failure (arg1: ErrorCode | ErrorType, arg2?: ErrorType): ApiResponse<any> {
    const errorCode: ErrorCode = typeof arg1 === 'number' ? arg1 : 500
    const error = this.getErrorObject(typeof arg1 === 'number' ? arg2! : arg1)

    this.logContext.logError(`Endpoint ${this.endpointName} encountered a ${errorCode} error after ${this.getDuration()} ms: `, error)

    return {
      success: false,
      timestamp: new Date().getTime(),
      error: {
        errorCode,
        errorType: API_ERRORS[errorCode],
        message: error.message
      }
    }
  }

  private getErrorObject (error: ErrorType): { message: string, stack?: string } {
    if (typeof error === 'string') {
      return { message: error }
    } else if (error instanceof Error) {
      // for some reason we can't directly stringify the error object - it just returns a string of an empty object
      // so copy its properties
      return { message: error.message, stack: error.stack }
    } else {
      return { message: 'CANNOT CONVERT ERROR TO STRING' }
    }
  }

  private getDuration (): number {
    return new Date().getTime() - this.start
  }
}
