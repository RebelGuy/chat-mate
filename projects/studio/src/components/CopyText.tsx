import { ContentCopy } from '@mui/icons-material'
import { IconButton, SxProps } from '@mui/material'
import { Box } from '@mui/system'
import { CSSProperties, useState } from 'react'

type Props = {
  text: string
  style?: CSSProperties
  sx?: SxProps
  tooltip?: string
  hideConfirmation?: boolean
}

export default function CopyText (props: Props) {
  const [showCopied, setShowCopied] = useState(false)
  const [timeout, setTimeout_] = useState<number | null>(null)

  const onCopy = () => {
    void navigator.clipboard.writeText(props.text)
    setShowCopied(true)
    if (timeout != null) {
      clearTimeout(timeout)
    }
    setTimeout_(window.setTimeout(() => setShowCopied(false), 2000))
  }

  return (
    <Box sx={props.sx} style={{ display: 'inline', ...(props.style ?? {}) }}>
      <span title={props.tooltip}>
        <IconButton onClick={onCopy}>
          <ContentCopy />
        </IconButton>
      </span>
      {showCopied && props.hideConfirmation !== true && <div style={{ display: 'inline' }}>Copied!</div>}
    </Box>
  )
}
