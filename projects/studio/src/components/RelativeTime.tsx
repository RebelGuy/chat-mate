import { Tooltip } from '@mui/material'
import { Box } from '@mui/system'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { useEffect, useState } from 'react'

type Props = {
  time: number
}

const ONE_MINUTE = 1000 * 60
const ONE_HOUR = ONE_MINUTE * 60
const ONE_DAY = ONE_HOUR * 24
const ONE_MONTH = ONE_DAY * (365.25/12)

export default function RelativeTime (props: Props) {
  const [elapsed, setElapsed] = useState(Date.now() - props.time)
  const [key] = useUpdateKey({ repeatInterval: getTimerInterval(elapsed) })

  useEffect(() => {
    setElapsed(Date.now() - props.time)
  }, [key, props.time])

  const text = getElapsedText(elapsed)

  return <>
    <Tooltip title={new Date(props.time).toLocaleString()}>
      <Box>
        {text}
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

function getElapsedText (elapsed: number) {
  let unit: string
  let amount: number
  if (elapsed < 5000) {
    return 'Just now'
  } else if (elapsed < ONE_MINUTE) {
    unit = 'second'
    amount = Math.floor(elapsed / 1000)
  } else if (elapsed < ONE_HOUR) {
    unit = 'minute'
    amount = Math.floor(elapsed / ONE_MINUTE)
  } else if (elapsed < ONE_DAY) {
    unit = 'hour'
    amount = Math.floor(elapsed / ONE_HOUR)
  } else if (elapsed < ONE_MONTH) {
    unit = 'day'
    amount = Math.floor(elapsed / ONE_DAY)
  } else {
    unit = 'month'
    amount = Math.floor(elapsed / ONE_MONTH)
  }

  if (amount !== 1) {
    unit += 's'
  }

  return `${amount} ${unit} ago`
}
