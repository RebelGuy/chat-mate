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
  const overridingStart = useRef<number | null>(null)

  const start = overridingStart?.current ?? props.initial

  requestAnimationFrame(() => {
    if (currentTime < startTime + props.duration) {
      setCurrentTime(Date.now())
    }
  })

  // don't reset the starting value if the target changes
  useEffect(() => {
    const newStart = Date.now()
    setStartTime(newStart)
    overridingStart.current = getNumber(newStart, currentTime, props.duration, start, props.target, props.decimals)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.target])

  const result = getNumber(startTime, currentTime, props.duration, start, props.target, props.decimals)
  return props.children(result)
}

function getNumber (startTime: number, currentTime: number, duration: number, start: number, target: number, decimals?: number) {
  const frac = clamp((currentTime - startTime) / duration, 0, 1)
  const modifiedFrac = frac === 1 ? 1 : 1 - Math.pow(2, -10 * frac) // exponential easing
  const rawResult = modifiedFrac * (target - start) + start
  return round(rawResult, decimals)
}
