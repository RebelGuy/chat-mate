import { useCallback } from 'react'

export default function useDebounce<TArgs extends any[]> (callback: (...args: TArgs) => void, ms: number) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(debounce(callback, ms), [])
}

function debounce<TArgs extends any[]> (callback: (...args: TArgs) => void, ms: number) {
  let timer: number | null = null

  return (...args: TArgs) => {
    if (timer != null) {
      window.clearTimeout(timer)
    }

    timer = window.setTimeout(() => {
      timer = null
      callback(...args)
    }, ms)
  }
}
