import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import LogService, { createLogContext, LogContext } from '@rebel/server/services/LogService'
import { Schema } from 'copy-webpack-plugin'

export const BASE_PATH = '/api'

export function buildPath (...pathParts: string[]) {
  return BASE_PATH + pathParts.map(p => '/' + p).join()
}

// to ensure that the type definitions across different consumers are synced, any changes
// to the api response schema should be accompanied by a bump of the schema version -
// this way the consumers can easily detect potential bugs.
export type ApiResponse<Schema extends number, T> = {
  schema: Schema
  timestamp: number
} & ({
  success: true
  data: T
} | {
  success: false
  error: ApiError
})

const API_ERRORS = {
  500: 'Internal Error',
  400: 'Bad Request',
  404: 'Not Found'
}

export type ErrorCode = keyof typeof API_ERRORS

export type ApiError = {
  message: string,
  errorCode: ErrorCode,
  errorType: string
}

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

  protected registerResponseBuilder<Schema extends number, Data> (endpointName: string, schema: Schema): ResponseBuilder<Schema> {
    return new ResponseBuilder(this.logContext, endpointName, schema)
  }
}

class ResponseBuilder<Schema extends number> {
  private readonly logContext: LogContext
  private readonly endpointName: string
  private readonly schema: Schema

  constructor (logContext: LogContext, endpointName: string, schema: Schema) {
    this.logContext = logContext
    this.endpointName = endpointName
    this.schema = schema
  }

  public success<Data> (data: Data): ApiResponse<Schema, Data> {
    this.logContext.logDebug(`Endpoint ${this.endpointName} processed the request successfully.`)

    return {
      success: true,
      timestamp: new Date().getTime(),
      schema: this.schema,
      data
    }
  }
  
  public failure (message: string): ApiResponse<Schema, any>
  public failure (errorCode: ErrorCode, message: string): ApiResponse<Schema, any>
  public failure (arg1: ErrorCode | string, arg2?: string): ApiResponse<Schema, any> {
    const errorCode: ErrorCode = typeof arg1 === 'number' ? arg1 : 500
    const message: string = typeof arg1 === 'number' ? arg2! : arg1

    this.logContext.logError(`Endpoint ${this.endpointName} encountered a ${errorCode} error:`, message)
    
    return {
      success: false,
      timestamp: new Date().getTime(),
      schema: this.schema,
      error: {
        errorCode,
        errorType: API_ERRORS[errorCode],
        message
      }
    }
  }
}
