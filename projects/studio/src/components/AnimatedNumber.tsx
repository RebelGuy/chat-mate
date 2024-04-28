import { clamp, round } from '@rebel/shared/util/math'
import { useEffect, useRef, useState } from 'react'

const MAX_FRAME_DURATION = 200

type Props = {
  initial: number
  target: number
  duration: number
  decimals?: number // can be negative if you wish
  smoothVelocity?: boolean // if true, slows down the animation update speed
  children: (num: number) => React.ReactElement
}

export default function AnimatedNumber (props: Props) {
  const [startTime, setStartTime] = useState(Date.now())
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [overridingStart, setOverridingStart] = useState<number | null>(null)
  const prevNumber = useRef<number | null>(null)
  const prevTarget = useRef(props.target)
  const nextFrameTime = useRef(Date.now())

  const animationHasCompleted = currentTime >= startTime + props.duration
  const shouldRenderFrame = nextFrameTime.current < currentTime

  requestAnimationFrame(() => {
    if (!animationHasCompleted) {
      setCurrentTime(Date.now())
    }
  })

  // don't reset the starting value if the target changes
  useEffect(() => {
    // during the last frame, the animation may not have run to completion (it may have stopped at a fram of 0.999).
    // update the effective value here using the previous target
    const start = overridingStart ?? props.initial
    result = getNumber(startTime, currentTime, props.duration, start, prevTarget.current, props.decimals)
    prevNumber.current = result

    const newStart = Date.now()
    setStartTime(newStart)
    setCurrentTime(newStart)
    setOverridingStart(prevNumber.current)
    prevTarget.current = props.target
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.target])

  // use the cached value if the target has changed, but the above side effect has not yet executed
  let result: number
  if (animationHasCompleted && prevTarget.current === props.target) {
    result = props.target
  } else if (!shouldRenderFrame || prevTarget.current !== props.target) {
    result = prevNumber.current ?? props.initial
  } else {
    const start = overridingStart ?? props.initial
    result = getNumber(startTime, currentTime, props.duration, start, props.target, props.decimals)
    prevNumber.current = result

    if (props.smoothVelocity) {
      const frameDuration = getFrameDuration(startTime, currentTime, props.duration)
      nextFrameTime.current = currentTime + frameDuration
    }
  }

  return props.children(result)
}

function getSmoothFrac (startTime: number, currentTime: number, duration: number) {
  const frac = getLinearFrac(startTime, currentTime, duration)
  const modifiedFrac = frac === 1 ? 1 : 1 - Math.pow(2, -10 * frac) // exponential easing
  return modifiedFrac
}

function getLinearFrac (startTime: number, currentTime: number, duration: number) {
  return clamp((currentTime - startTime) / duration, 0, 1)
}

function getNumber (startTime: number, currentTime: number, duration: number, start: number, target: number, decimals?: number) {
  const frac = getSmoothFrac(startTime, currentTime, duration)
  const rawResult = frac * (target - start) + start
  return round(rawResult, decimals)
}

function getFrameDuration (startTime: number, currentTime: number, duration: number) {
  const frac = getLinearFrac(startTime, currentTime, duration)
  return MAX_FRAME_DURATION * frac * frac
}
