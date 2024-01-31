import { Primitive } from '@rebel/shared/types'

/** Public objects are containers for primitive values or other public objects. */
export type PublicObject<T extends ResponseData<T>> = T extends ResponseData<any> ? T : never

/** The root of the response data must consist exclusively of primitives and PublicObjects. */
export type ResponseData<T extends ResponseData<T>> = {
  // Note: the `extends self` condition is useful so that we get compile errors - otherwise, our typing will just remove (`never`) ineligible properties from T.

  // each property must be one of the following types:
  [K in keyof T]
    // nullable primitive types
    : T[K] extends Primitive | null ? T[K]

    // primitive arrays
    : T[K] extends Primitive[] ? T[K]

    // arrays of PublicObject types (this must be moved before the object types in the lines below, otherwise we get an excessive depth error)
    : T[K] extends Array<infer ArrObj> ? (ArrObj extends ResponseData<infer PO> ? (PO extends ArrObj ? PO[] : never) : never)

    // nullable PulicObject types
    : T[K] extends ResponseData<infer PO> ? (PO extends T[K] ? PO : never)
    : T[K] extends ResponseData<infer PO> | null ? (PO extends Exclude<T[K], null> ? PO | null : never)

    // don't allow anything else
    : never
}

export type ApiResponse<T> = T extends ResponseData<infer U> ? T extends U ? ({
  timestamp: number
} & ({
  success: true
  data: T
} | {
  success: false
  error: ApiError
})) : never : never

/** Extracts the `data` component from an `ApiResponse` object. */
export type ApiResponseData<T extends ApiResponse<any>> = Extract<T, { success: true }>['data']

export type ApiRequest<T extends PublicObject<any>> = T

export const API_ERRORS = {
  500: 'Internal Error',
  400: 'Bad Request',
  401: 'Unauthorised',
  403: 'Forbidden',
  404: 'Not Found',
  422: 'Unprocessable Entity'
}

export type ErrorCode = keyof typeof API_ERRORS

export type ApiError = {
  message: string
  errorCode: ErrorCode
  errorType: string
  internalErrorType: string
}
