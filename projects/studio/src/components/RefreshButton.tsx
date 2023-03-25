import { Refresh } from '@mui/icons-material'
import { CircularProgress, IconButton } from '@mui/material'

type Props = {
  isLoading: boolean
  onRefresh: () => void
}

export default function RefreshButton (props: Props) {
  return (
    <IconButton onClick={props.onRefresh} disabled={props.isLoading}>
      {props.isLoading ? <CircularProgress size="24px" /> : <Refresh />}
    </IconButton>
  )
}
