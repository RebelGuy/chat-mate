import { ApiError } from '@rebel/api-models/types'
import React, { useState } from 'react'

type Props = {
  children: React.ReactNode
}

export type RequestContextType<TResponseData> = (cacheKey: string) =>
  RequestMethods<TResponseData> & {
  removeCache: () => void
}

type RequestMethods<TResponseData> = {
  isLoading: boolean
  setIsLoading: (isLoading: boolean) => void
  data: TResponseData | null
  setData: (data: TResponseData | null) => void
  apiError: ApiError | null
  setApiError: (error: ApiError | null) => void
}

export function RequestContextProvider (props: Props) {
  const [cache, setCache] = useState<Record<string, RequestMethods<any>>>({});

  // save to the `window` for easier debugging
  (window as any)['requestCache'] = cache

  const requestContextValue = () => (cacheKey: string): ReturnType<RequestContextType<any>> => {
    // when updating a cache entry, make sure we update the reference in the state to trigger a re-render.
    // this can probably be optimised in the future to reduce the number of re-renders
    const updateCachedEntry = (onUpdate: (value: RequestMethods<any>) => void) => {
      setCache(prevCache => {
        const entry = prevCache[cacheKey]
        if (entry == null) {
          console.warn(`Unable to update cache with key ${cacheKey} because no entry exists`)
          return prevCache
        }

        let newCache = { ...prevCache }
        let updatedEntry = { ...entry }
        onUpdate(updatedEntry)
        newCache[cacheKey] = updatedEntry
        return newCache
      })
    }

    // initialise
    if (!Object.keys(cache).includes(cacheKey)) {
      console.debug('Creating cache for key', cacheKey)
      const newCacheEntry: RequestMethods<any> = {
        isLoading: false,
        setIsLoading: isLoading => updateCachedEntry(entry => entry.isLoading = isLoading),
        data: null,
        setData: data => updateCachedEntry(entry => entry.data = data),
        apiError: null,
        setApiError: error => updateCachedEntry(entry => entry.apiError = error),
      }
      cache[cacheKey] = newCacheEntry
    }

    const methods = cache[cacheKey]

    const removeCache = () => setCache(prevCache => {
      let newCache = { ...prevCache }

      if (Object.keys(newCache).includes(cacheKey)) {
        delete newCache[cacheKey]
      } else {
        console.warn(`Cannot remove cache key ${cacheKey} because it does not exist in the cache`)
      }

      return newCache
    })

    return {
      ...methods,
      removeCache
    }
  }

  return (
    <RequestContext.Provider
      value={requestContextValue()}
    >
      {props.children}
    </RequestContext.Provider>
  )
}

const RequestContext = React.createContext<RequestContextType<any>>(null!)
export default RequestContext
