import { SxProps, Tooltip } from '@mui/material'
import { Box } from '@mui/system'
import { toSentenceCase } from '@rebel/shared/util/text'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { useEffect, useState } from 'react'
import { getElapsedText, ONE_HOUR, ONE_MINUTE } from '@rebel/shared/util/datetime'

type Props = {
  time: number
  maxDepth?: number
  prefix?: string
  suffix?: string
  useSentenceCase?: boolean
  sx?: SxProps
}

export default function RelativeTime (props: Props) {
  const maxDepth = props.maxDepth ?? 0
  const [elapsed, setElapsed] = useState(Date.now() - props.time)
  const [key] = useUpdateKey({ repeatInterval: getTimerInterval(Math.abs(elapsed), maxDepth) })

  useEffect(() => {
    setElapsed(Date.now() - props.time)
  }, [key, props.time])

  const text = getElapsedText(Math.abs(elapsed), maxDepth)

  return <>
    {props.prefix}
    <Tooltip title={new Date(props.time).toLocaleString()} disableInteractive>
      <Box sx={{ display: 'inline', ...(props.sx ?? {}) }}>
        {props.useSentenceCase ? toSentenceCase(text) : text}
      </Box>
    </Tooltip>
    {props.suffix}
  </>
}

function getTimerInterval (elapsed: number, maxDepth: number) {
  let level: number
  if (elapsed < ONE_MINUTE) {
    level = 0
  } else if (elapsed < ONE_HOUR) {
    level = 1
  } else {
    level = 2
  }

  level -= maxDepth

  if (level <= 0) {
    return 1000
  } else if (level === 1) {
    return ONE_MINUTE
  } else {
    return ONE_MINUTE * 10
  }
}
