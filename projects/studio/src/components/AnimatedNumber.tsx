import { clamp } from '@rebel/shared/util/math'
import { useState } from 'react'

type Props = {
  initial: number
  target: number
  duration: number
  children: (num: number) => React.ReactElement
}

export default function AnimatedNumber (props: Props) {
  const [startTime] = useState(Date.now())
  const [currentTime, setCurrentTime] = useState(Date.now())

  requestAnimationFrame(() => {
    if (currentTime < startTime + props.duration) {
      setCurrentTime(Date.now())
    }
  })

  const frac = clamp((currentTime - startTime) / props.duration, 0, 1)
  const modifiedFrac = frac === 1 ? 1 : 1 - Math.pow(2, -10 * frac) // exponential easing
  const result = Math.round(modifiedFrac * (props.target - props.initial) + props.initial)

  return props.children(result)
}
