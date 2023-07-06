import { Primitive } from '@rebel/shared/types'

/** Public objects are containers for primitive values or other public objects. */
export type PublicObject<T extends ResponseData<any>> = ResponseData<T>

/** The root of the response data must consist exclusively of primitives and PublicObjects. */
export type ResponseData<T extends ResponseData<T>> = {
  // Note: the `extends self` condition is useful so that we get compile errors - otherwise, our typing will just remove (`never`) ineligible properties from T.

  // each property must be one of the following types:
  [K in keyof T]
    // nullable primitive types
    : T[K] extends Primitive | null ? T[K]

    // primitive arrays
    : T[K] extends Primitive[] ? T[K]

    // nullable PulicObject types
    : T[K] extends PublicObject<infer PO> ? PO
    : T[K] extends PublicObject<infer PO> | null ? PO | null

    // arrays of PublicObject types
    : T[K] extends Array<infer ArrObj> ? (ArrObj extends PublicObject<infer PO> ? PO[] : never)

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
