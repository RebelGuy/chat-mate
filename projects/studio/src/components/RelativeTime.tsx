import { SxProps, Tooltip } from '@mui/material'
import { Box } from '@mui/system'
import { toSentenceCase } from '@rebel/shared/util/text'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { useEffect, useState } from 'react'
import { getElapsedText, ONE_HOUR, ONE_MINUTE } from '@rebel/shared/util/datetime'

type Props = {
  time: number
  useSentenceCase?: boolean
  sx?: SxProps
}

export default function RelativeTime (props: Props) {
  const [elapsed, setElapsed] = useState(Date.now() - props.time)
  const [key] = useUpdateKey({ repeatInterval: getTimerInterval(elapsed) })

  useEffect(() => {
    setElapsed(Date.now() - props.time)
  }, [key, props.time])

  const text = getElapsedText(elapsed)

  return <>
    <Tooltip title={new Date(props.time).toLocaleString()}>
      <Box sx={{ display: 'inline', ...(props.sx ?? {}) }}>
        {props.useSentenceCase ? toSentenceCase(text) : text}
      </Box>
    </Tooltip>
  </>
}

function getTimerInterval (elapsed: number) {
  if (elapsed < ONE_MINUTE) {
    return 1000
  } else if (elapsed < ONE_MINUTE * 10) {
    return 5000
  } else if (elapsed < ONE_HOUR) {
    return ONE_MINUTE
  } else {
    return ONE_MINUTE * 10
  }
}
