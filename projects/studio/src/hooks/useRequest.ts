import { ApiError, ApiResponse, ResponseData } from '@rebel/server/controllers/ControllerBase'
import { GenericObject, MakeRequired, Primitive } from '@rebel/shared/types'
import { objToArr, values } from '@rebel/shared/util/arrays'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { SERVER_URL } from '@rebel/studio/utility/global'
import { useContext, useEffect, useState } from 'react'

const LOGIN_TOKEN_HEADER = 'X-Login-Token'
const STREAMER_HEADER = 'X-Streamer'

const baseUrl = SERVER_URL + '/api'

type RequestOptions = {
  method?: string
  requestData?: Record<string, Primitive> | null
  updateKey?: Primitive
  requiresLogin?: boolean
  requiresStreamer?: boolean
}

type RequestReturn<TData> = {
  data: TData | null
  isLoading: boolean
  error: ApiRequestError | null
}

export type ApiRequestError = {
  message: string
  onRetry?: () => void
}


const DEFAULT_OPTIONS: RequestOptions = {
  method: 'GET',
  requestData: null,
  updateKey: 0,
  requiresLogin: true,
  requiresStreamer: true
}

export default function useRequest<
  TResponse extends ApiResponse<any>,
  TData extends Extract<TResponse, { success: true }>['data'] = Extract<TResponse, { success: true }>['data']
> (path: string, options?: RequestOptions): RequestReturn<TData> {
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<TData | null>(null)
  const [apiError, setError] = useState<ApiError | null>(null)
  const [onRetry, setOnRetry] = useState<(() => void) | null>(null)
  const loginContext = useContext(LoginContext)

  const method = firstDefined('method', options, DEFAULT_OPTIONS)
  const requestData = firstDefined('requestData', options, DEFAULT_OPTIONS)
  const updateKey = firstDefined('updateKey', options, DEFAULT_OPTIONS)
  const requiresLogin = firstDefined('requiresLogin', options, DEFAULT_OPTIONS)
  const requiresStreamer = firstDefined('requiresStreamer', options, DEFAULT_OPTIONS)

  const loginToken = requiresLogin ? loginContext.loginToken : null
  const streamer = requiresStreamer ? loginContext.streamer : null

  useEffect(() => {
    const makeRequest = async () => {
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
        const rawResponse = await fetch(baseUrl + path, {
          method: method,
          body: requestData == null ? undefined : JSON.stringify(requestData),
          headers: headers
        })
        const response: ApiResponse<TData> = JSON.parse(await rawResponse.text())

        if (response.success) {
          setIsLoading(false)
          setData(response.data)
          setError(null)
        } else {
          setIsLoading(false)
          setData(null)
          setError(response.error)
        }
      } catch (e: any) {
        setIsLoading(false)
        setData(null)
        setError({ errorCode: 500, errorType: 'Unkonwn', message: e.message })
      }
    }

    setOnRetry(() => () => makeRequest())

    void makeRequest()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, method, loginToken, streamer, updateKey, ...objToArr(requestData ?? {})])

  const error: ApiRequestError | null = apiError == null ? null : { message: apiError.message, onRetry: onRetry ?? undefined }
  return { data, isLoading, error }
}

function firstDefined<T, K extends keyof T> (key: K, a: T | undefined, b: T) {
  return a != null && a[key] !== undefined ? a[key] : b[key] as Exclude<MakeRequired<T[K]>, undefined>
}
