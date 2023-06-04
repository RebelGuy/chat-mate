import { clamp, round } from '@rebel/shared/util/math'
import { useEffect, useRef, useState } from 'react'

type Props = {
  initial: number
  target: number
  duration: number
  decimals?: number // can be negative if you wish
  children: (num: number) => React.ReactElement
}

export default function AnimatedNumber (props: Props) {
  const [startTime, setStartTime] = useState(Date.now())
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [overridingStart, setOverridingStart] = useState<number | null>(null)
  const prevNumber = useRef<number | null>(null)
  const prevTarget = useRef(props.target)

  requestAnimationFrame(() => {
    if (currentTime < startTime + props.duration) {
      setCurrentTime(Date.now())
    }
  })

  // don't reset the starting value if the target changes
  useEffect(() => {
    const newStart = Date.now()
    setStartTime(newStart)
    setCurrentTime(newStart)
    setOverridingStart(prevNumber.current)
    prevTarget.current = props.target
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.target])

  // use the cached value if the target has changed, but the above side effect has not yet executed
  let result: number
  if (prevTarget.current !== props.target) {
    result = prevNumber.current ?? props.initial
  } else {
    const start = overridingStart ?? props.initial
    result = getNumber(startTime, Date.now(), props.duration, start, props.target, props.decimals)
    prevNumber.current = result
  }

  return props.children(result)
}

function getNumber (startTime: number, currentTime: number, duration: number, start: number, target: number, decimals?: number) {
  const frac = clamp((currentTime - startTime) / duration, 0, 1)
  const modifiedFrac = frac === 1 ? 1 : 1 - Math.pow(2, -10 * frac) // exponential easing
  const rawResult = modifiedFrac * (target - start) + start
  return round(rawResult, decimals)
}
