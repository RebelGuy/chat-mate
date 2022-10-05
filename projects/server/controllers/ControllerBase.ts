import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import LogService, { createLogContext, LogContext } from '@rebel/server/services/LogService'

export const BASE_PATH = '/api'

export function buildPath (...pathParts: string[]) {
  return BASE_PATH + pathParts.map(p => '/' + p).join()
}

// to ensure that the type definitions across different consumers are synced, any changes
// to the api response schema should be accompanied by a bump of the schema version -
// this way the consumers can easily detect potential bugs.
export type ApiResponse<Schema extends number, T extends ResponseData<T>> = {
  schema: Schema
  timestamp: number
} & ({
  success: true
  data: T
} | {
  success: false
  error: ApiError
})

export type ApiRequest<Schema extends number, T extends {schema: Schema } & PublicObject<Schema, T>> = T

/** The root of the response data can be primitives or PublicObjects, and does not directly need to be schema-tagged. */
export type ResponseData<T extends ResponseData<T>> = {
  // Note: the `extends self` condition is useful so that we get compile errors - otherwise, our typing will just remove (`never`) ineligible properties from T.

  // each property must be one of the following types:
  [K in keyof T]
    // nullable primitive types
    : T[K] extends number | string | boolean | null ? T[K]

    // primitive arrays
    : T[K] extends number[] | string[] | boolean[] ? T[K]

    // nullable schema-tagged object types
    : T[K] extends PublicObject<any, infer PO> ? PO
    : T[K] extends PublicObject<any, infer PO> | null ? PO | null

    // arrays of schema-tagged object types
    : T[K] extends Array<infer ArrObj> ? (ArrObj extends PublicObject<any, infer PO> ? PO[] : never)

    // don't allow anything else
    : never
}

// The advantage of the public object model is that whenever we bump the schema, we will get compile errors everywhere where the
// model has been instantiated, preventing us from forgetting to update any code that may rely on a certain schema version to function properly.
/** Public objects must be tagged by a concrete schema, and can consist of only primitives or other public objects, or arrays thereof. */
export type PublicObject<Schema extends number, T extends { schema: Schema } & ResponseData<T>> = ResponseData<T>

/** Helper type for cascading-up public object schema changes. */
export type Tagged<Schema extends number, T extends {schema: Schema} & PublicObject<Schema, any>> = T

/** Extracts the `data` component from an `ApiResponse` object. */
export type ExtractedData<T extends ApiResponse<any, any>> = Extract<T, { success: true }>['data']

/** Utility type that defines the shape any endpoint implementation methods should have. */
export type Endpoint<Schema extends number, Args, T extends ApiResponse<any, any>> = (args: Args & { builder: ResponseBuilder<Schema, ExtractedData<T>> }) => Promise<T>

/** The input argument for an endpoint implementation method. */
export type In<E extends Endpoint<any, any, any>> = Parameters<E>['0']

/** The output arguemnt for an endpoint implementation method. */
export type Out<E extends Endpoint<any, any, any>> = ReturnType<E>

const API_ERRORS = {
  500: 'Internal Error',
  400: 'Bad Request',
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
}>

type Deps = Dependencies<{
  logService: LogService
}>

export abstract class ControllerBase extends ContextClass {
  readonly name: string
  protected readonly logService: LogService
  protected readonly logContext: LogContext

  constructor (deps: Deps, controllerName: string) {
    super()
    this.name = controllerName
    this.logService = deps.resolve('logService')
    this.logContext = createLogContext(this.logService, this)
  }

  protected registerResponseBuilder<
    R extends ApiResponse<Schema, T>,
    Schema extends number = R['schema'],
    T extends ResponseData<T> = Extract<R, { success: true }>['data'] // wow!
  > (endpointName: string, schema: Schema): ResponseBuilder<Schema, T> {
    return new ResponseBuilder(this.logContext, endpointName, schema)
  }
}

export class ResponseBuilder<Schema extends number, T extends ResponseData<T>> {
  private readonly logContext: LogContext
  private readonly endpointName: string
  private readonly start: number

  public readonly schema: Schema

  constructor (logContext: LogContext, endpointName: string, schema: Schema) {
    this.logContext = logContext
    this.endpointName = endpointName
    this.start = new Date().getTime()
    this.schema = schema
  }

  public success (data: T): ApiResponse<Schema, T> {
    this.logContext.logDebug(`Endpoint ${this.endpointName} processed the request successfully after ${this.getDuration()} ms.`)

    return {
      success: true,
      timestamp: new Date().getTime(),
      schema: this.schema,
      data
    }
  }

  public failure (error: ErrorType): ApiResponse<Schema, any>
  public failure (errorCode: ErrorCode, error: ErrorType): ApiResponse<Schema, any>
  public failure (arg1: ErrorCode | ErrorType, arg2?: ErrorType): ApiResponse<Schema, any> {
    const errorCode: ErrorCode = typeof arg1 === 'number' ? arg1 : 500
    const error = this.getErrorObject(typeof arg1 === 'number' ? arg2! : arg1)

    this.logContext.logError(`Endpoint ${this.endpointName} encountered a ${errorCode} error after ${this.getDuration()} ms: `, error)

    return {
      success: false,
      timestamp: new Date().getTime(),
      schema: this.schema,
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
