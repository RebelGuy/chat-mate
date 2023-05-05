import { ApiError, ApiRequest, ApiResponse, PublicObject, ResponseData } from '@rebel/server/controllers/ControllerBase'
import { Primitive } from '@rebel/shared/types'
import { isPrimitive, NO_OP } from '@rebel/shared/util/typescript'
import LoginContext, { LoginContextType } from '@rebel/studio/contexts/LoginContext'
import { SERVER_URL } from '@rebel/studio/utility/global'
import { useContext, useEffect, useRef, useState } from 'react'

const LOGIN_TOKEN_HEADER = 'X-Login-Token'
const STREAMER_HEADER = 'X-Streamer'

const baseUrl = SERVER_URL + '/api'

type RequestOptions<TResponseData> = {
  // forces the request to refresh. has no effect when `onDemand` is true
  updateKey?: Primitive

  // don't auto-start the request on mount or when the props change (even if the `updateKey` changes).
  // instead, the request is made only when `triggerRequest()` is called
  onDemand?: boolean

  // only required if using `useRequest` from within the LoginContext itself
  loginToken?: string | null
  streamer?: string | null

  // IMPORTANT: changing callback functions does NOT trigger a new request, so they do not need to be memoised.

  // called before the request is fired. return true to cancel the request.
  onRequest?: () => true | any

  // inline version of `useEffect(() => { if (data != null) { /* handle data here */ } }, [data])
  onSuccess?: (data: TResponseData, type: RequestType) => void

  // applied to the response data every time it changes
  transformer?: (data: TResponseData) => TResponseData

  // inline version of `useEffect(() => { if (error != null) { /* handle error here */ } }, [error])
  onError?: (error: ApiError, type: RequestType) => void

  // called after `onSuccess` or `onError`
  onDone?: () => void
}

// `none` is only used before the first request has been made, and never again in the future.
export type RequestType = 'none' | 'auto-initial' | 'auto-refresh' | 'triggered' | 'retry'

export type RequestResult<TResponseData> = {
  // the data object remains available until the next request has completed.
  // at that point, it gets either overwritten (if request succeeded) or cleared (if request failed).
  data: TResponseData | null

  // whether a request is currently in progress
  isLoading: boolean

  // the error object remains available until the next request has completed.
  // at that point, it gets either cleared (if request succeeded) or overwritten (if request failed again).
  error: ApiRequestError | null

  requestType: RequestType

  // calling this function will force-trigger a request. similar to `error.onRetry()` but uses the current props.
  // if `onDemand` is `true`, this is the only way to make a request.
  triggerRequest: () => void

  // calling this function will reset the state to the initial state or set the given data/error.
  // setting both the data and error leads to undefined behaviour.
  reset: (useData?: TResponseData, useError?: ApiError) => void

  // manually change the response data
  mutate: (newData: TResponseData | null) => void
}

export type SuccessfulResponseData<TResponse extends ApiResponse<any>> = Extract<TResponse, { success: true }>['data']

export type ApiRequestError = {
  message: string
  onRetry?: () => void
}

export type Method = 'GET' | 'POST' | 'DELETE' | 'PATCH'

export type Request<TResponse extends ApiResponse<any>, TRequestData extends PublicObject<TRequestData extends false ? never : TRequestData> | false> = {
  method: Method
  path: string
  data: TRequestData extends false ? never : Method extends 'GET' ? never : TRequestData

  // defaults to true
  requiresLogin?: boolean

  // defaults to true, which will use the currently selected streamer.
  // if 'self', will use the currently logged-in user as the streamer.
  requiresStreamer?: boolean | 'self'
}

export default function useRequest<
  TResponse extends ApiResponse<any>,
  TRequestData extends PublicObject<TRequestData extends false ? never : TRequestData> | false = false,
  TResponseData extends SuccessfulResponseData<TResponse> = SuccessfulResponseData<TResponse>
> (request: Request<TResponse, TRequestData>, options?: RequestOptions<TResponseData>): RequestResult<TResponseData> {
  const [isLoading, setIsLoading] = useState(false)
  const [requestType, setRequestType] = useState<RequestType>('none')
  const [data, setData] = useState<TResponseData | null>(null)
  const [apiError, setError] = useState<ApiError | null>(null)
  const [onRetry, setOnRetry] = useState<(() => void) | null>(null)
  let loginContext = useContext(LoginContext)

  // this is essentially `useState` but it updates the value immediately.
  // concept stolen from https://stackoverflow.com/a/60643670
  const invariantRef = useRef<number>(0)

  if (loginContext == null) {
    if (request.requiresLogin === true && options?.loginToken == null) {
      throw new Error('`userRequest` cannot use LoginContext because it is null and no `loginToken` has been provided')
    } else if (request.requiresStreamer === true && options?.streamer == null) {
      throw new Error('`userRequest` cannot use LoginContext because it is null and no `streamer` has been provided')
    }

    loginContext = {
      loginToken: options!.loginToken,
      streamer: options!.streamer
    } as LoginContextType
  }

  // if adding non-callbacks onto these constants, make sure to update the dependency array of the `makeRequest` function
  const path = request.path
  const method = request.method
  const requestData = (request.data ?? null) as PublicObject<any> | null
  const requiresLogin = request.requiresLogin ?? true
  const requiresStreamer = request.requiresStreamer ?? true
  const updateKey = options?.updateKey ?? 0
  const onDemand = options?.onDemand ?? false
  const transformer = options?.transformer ?? null
  const onSuccess = options?.onSuccess ?? NO_OP
  const onError = options?.onError ?? NO_OP
  const onDone = options?.onDone ?? NO_OP
  const onRequest: () => true | any = options?.onRequest ?? NO_OP

  const loginToken = requiresLogin ? loginContext.loginToken : null
  const streamer = requiresStreamer === true ? loginContext.streamer : requiresStreamer === 'self' ? loginContext.username : null

  const makeRequest = async (type: RequestType) => {
    let headers: HeadersInit = {
      'Content-Type': 'application/json'
    }
    if (loginToken != null) {
      headers[LOGIN_TOKEN_HEADER] = loginToken
    }
    if (streamer != null) {
      headers[STREAMER_HEADER] = streamer
    }

    const invariant = invariantRef.current + 1 // only track one request at a time (the most recently started)
    invariantRef.current = invariant

    try {
      if (requiresLogin && loginToken == null) {
        throw new Error('You must be logged in to do that.')
      } else if (requiresStreamer === true && streamer == null) {
        throw new Error('You must select a streamer to do that.')
      } else if (requiresStreamer === 'self' && !loginContext.isStreamer) {
        throw new Error('You must be a streamer to do that.')
      }

      if (onRequest() === true) {
        return
      }

      setIsLoading(true)

      const rawResponse = await fetch(baseUrl + path, {
        method: method,
        body: requestData == null ? undefined : JSON.stringify(requestData),
        headers: headers
      })
      const response: ApiResponse<TResponseData> = JSON.parse(await rawResponse.text())

      if (invariantRef.current !== invariant) {
        return
      }

      if (response.success) {
        const responseData = transformer == null ? response.data : transformer(response.data)
        setData(responseData)
        setError(null)
        onSuccess(responseData, type)
      } else {
        setData(null)
        setError(response.error)
        onError(response.error, type)
      }
    } catch (e: any) {
      if (invariantRef.current !== invariant) {
        return
      }

      setData(null)
      const error: ApiError = { errorCode: 500, errorType: 'Unkonwn', internalErrorType: 'Unknown', message: e.message }
      setError(error)
      onError(error, type)
    } finally {
      if (invariantRef.current === invariant) {
        setIsLoading(false)
        setRequestType(type)
        onDone()
      }
    }
  }

  // for handling a manual request
  const triggerRequest = () => {
    void makeRequest('triggered')
    setOnRetry(() => () => makeRequest('retry'))
  }

  const reset = (useData?: TResponseData, useError?: ApiError) => {
    invariantRef.current = invariantRef.current + 1
    setIsLoading(false)
    setData(useData ?? null)
    setError(useError ?? null)
  }

  const mutate = (newData: TResponseData | null) => {
    setData(newData)
  }

  // for handling the automatic request
  useEffect(() => {
    if (!onDemand) {
      void makeRequest(requestType === 'none' ? 'auto-initial' : 'auto-refresh')
      setOnRetry(() => () => makeRequest('retry'))
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, method, requiresLogin, loginToken, requiresStreamer, streamer, updateKey, onDemand, ...objToArr(requestData ?? {})])

  const error: ApiRequestError | null = apiError == null ? null : { message: apiError.message, onRetry: onRetry ?? undefined }
  return { data, isLoading, error, requestType, triggerRequest, reset, mutate }
}

// returns true if the request should be cancelled
export function onConfirmRequest (msg: string) {
  return !window.confirm(msg)
}

function objToArr<T extends ResponseData<T>> (obj: PublicObject<T>): (Primitive | null)[] {
  const keys = Object.keys(obj).sort() as (keyof T)[]
  return keys.flatMap<Primitive | null>(key => {
    const value = obj[key]
    if (isPrimitive(typeof value) || value == null) {
      return [value as Primitive | null]
    } else if (Array.isArray(value)) {
      // I aplogise for the typings
      return (value as any).flatMap((item: any) => isPrimitive(typeof item) || item == null ? [item] : objToArr(item as any))
    } else {
      return objToArr(value)
    }
  })
}
