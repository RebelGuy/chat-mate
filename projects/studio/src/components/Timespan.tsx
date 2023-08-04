import { SxProps } from '@mui/material'
import { Box } from '@mui/system'
import { toSentenceCase } from '@rebel/shared/util/text'
import { getElapsedText } from '@rebel/shared/util/datetime'

type Props = {
  start: number
  end: number
  useSentenceCase?: boolean
  sx?: SxProps

  // if true, will count milliseconds
  allowMs?: boolean
}


export default function TimeSpan (props: Props) {
  const elapsed = props.end - props.start
  const text = getElapsedText(elapsed, props.allowMs)

  return <>
    <Box sx={{ display: 'inline', ...(props.sx ?? {}) }}>
      {props.useSentenceCase ? toSentenceCase(text) : text}
    </Box>
  </>
}
