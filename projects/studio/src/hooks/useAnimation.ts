import { useEffect, useRef } from 'react'

type AnimationCallback<TParams> = (t: number, delta: number, params: TParams) => void

export default function useAnimation<TParams> (callback: AnimationCallback<TParams>, params: TParams) {
  const startTime = useRef<number>(Date.now())
  const lastTime = useRef<number>(Date.now())
  const isUnmounted = useRef<boolean>(false)
  const requestRef = useRef<number | null>(null)
  const paramsRef = useRef<TParams>(params)

  paramsRef.current = params

  const doAnimation = () => {
    const now = Date.now()
    const delta = now - lastTime.current
    lastTime.current = now

    callback(now - startTime.current, delta, paramsRef.current)

    if (!isUnmounted.current) {
      requestRef.current = requestAnimationFrame(doAnimation)
    }
  }

  function onUnmount () {
    if (requestRef.current != null) {
      cancelAnimationFrame(requestRef.current)
    }
  }

  useEffect(() => {
    requestAnimationFrame(doAnimation)

    return (onUnmount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
