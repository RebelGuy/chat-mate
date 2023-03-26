import { ApiError, ApiRequest, ApiResponse } from '@rebel/server/controllers/ControllerBase'
import { Primitive } from '@rebel/shared/types'
import { objToArr } from '@rebel/shared/util/arrays'
import { NO_OP } from '@rebel/shared/util/typescript'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { SERVER_URL } from '@rebel/studio/utility/global'
import { useContext, useEffect, useState } from 'react'

const LOGIN_TOKEN_HEADER = 'X-Login-Token'
const STREAMER_HEADER = 'X-Streamer'

const baseUrl = SERVER_URL + '/api'

type RequestOptions<TResponseData> = {
  // forces the request to refresh. has no effect when `onDemand` is true
  updateKey?: Primitive

  // don't auto-start the request on mount or when the props change
  onDemand?: boolean

  // inline version of `useEffect(() => { if (data != null) { /* handle data here */ } }, [data])
  onSuccess?: (data: TResponseData, type: RequestType) => void

  // inline version of `useEffect(() => { if (error != null) { /* handle error here */ } }, [error])
  onError?: (error: ApiError, type: RequestType) => void
}

// `none` is only used before the first request has been made, and never again in the future.
export type RequestType = 'none' | 'auto-initial' | 'auto-refresh' | 'triggered' | 'retry'

export type RequestResult<TResponseData> = {
  // the data object remains available until the next request has completed
  data: TResponseData | null

  // whether a request is currently in progress
  isLoading: boolean

  // the error object remains available until the next request has completed
  error: ApiRequestError | null

  requestType: RequestType

  // calling this function will force-trigger a request. similar to `error.onRetry()` but uses the current props
  triggerRequest: () => void
}

export type SuccessfulResponseData<TResponse extends ApiResponse<any>> = Extract<TResponse, { success: true }>['data']

export type ApiRequestError = {
  message: string
  onRetry?: () => void
}

export type Method = 'GET' | 'POST' | 'DELETE' | 'PATCH'

export type Request<TResponse extends ApiResponse<any>, TRequestData extends Record<string, Primitive> | false> = {
  method: Method
  path: string
  data: TRequestData extends false ? never : Method extends 'GET' ? never : TRequestData

  // defaults to true
  requiresLogin?: boolean

  // defaults to true
  requiresStreamer?: boolean
}

export default function useRequest<
  TResponse extends ApiResponse<any>,
  TRequestData extends Record<string, Primitive> | false = false,
  TResponseData extends SuccessfulResponseData<TResponse> = SuccessfulResponseData<TResponse>
> (request: Request<TResponse, TRequestData>, options?: RequestOptions<TResponseData>): RequestResult<TResponseData> {
// > (path: string, options?: RequestOptions<TResponseData, TRequestData>): RequestReturn<TResponseData> {
  const [isLoading, setIsLoading] = useState(false)
  const [requestType, setRequestType] = useState<RequestType>('none')
  const [data, setData] = useState<TResponseData | null>(null)
  const [apiError, setError] = useState<ApiError | null>(null)
  const [onRetry, setOnRetry] = useState<(() => void) | null>(null)
  const loginContext = useContext(LoginContext)

  const path = request.path
  const method = request.method
  const requestData = (request.data ?? null) as Record<string, Primitive> | null
  const requiresLogin = request.requiresLogin ?? true
  const requiresStreamer = request.requiresStreamer ?? true
  const updateKey = options?.updateKey ?? 0
  const onDemand = options?.onDemand ?? false
  const onSuccess = options?.onSuccess ?? NO_OP
  const onError = options?.onError ?? NO_OP

  const loginToken = requiresLogin ? loginContext.loginToken : null
  const streamer = requiresStreamer ? loginContext.streamer : null

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

    setIsLoading(true)
    setError(null)

    try {
      if (requiresLogin && loginToken == null) {
        throw new Error('You must be logged in to do that.')
      } else if (requiresStreamer && streamer == null) {
        throw new Error('You must select a streamer.')
      }

      const rawResponse = await fetch(baseUrl + path, {
        method: method,
        body: requestData == null ? undefined : JSON.stringify(requestData),
        headers: headers
      })
      const response: ApiResponse<TResponseData> = JSON.parse(await rawResponse.text())

      if (response.success) {
        setData(response.data)
        setError(null)
        onSuccess(response.data, type)
      } else {
        setData(null)
        setError(response.error)
        onError(response.error, type)
      }
    } catch (e: any) {
      setData(null)
      const error: ApiError = { errorCode: 500, errorType: 'Unkonwn', message: e.message }
      setError(error)
      onError(error, type)
    } finally {
      setIsLoading(false)
      setRequestType(type)
    }
  }

  // for handling a manual request
  const triggerRequest = () => {
    void makeRequest('triggered')
    setOnRetry(() => () => makeRequest('retry'))
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
  return { data, isLoading, error, requestType, triggerRequest }
}
