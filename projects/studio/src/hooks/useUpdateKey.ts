import { useEffect, useRef, useState } from 'react'

type Options = {
  // automatically refreshes the key at the given interval. if the key is manually updated, the current interval will reset
  repeatInterval?: number
}

export default function useUpdateKey (options?: Options) {
  const [key, setKey] = useState(0)
  const timeoutRef = useRef<number | null>(null)

  const updateKey = () => setKey(currentKey => currentKey + 1)

  useEffect(() => {
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current)
    }

    if (options?.repeatInterval == null) {
      return
    }

    timeoutRef.current = window.setInterval(() => {
      updateKey()
    }, options.repeatInterval)

    return () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [key, options?.repeatInterval])

  return [key, updateKey] as const
}
