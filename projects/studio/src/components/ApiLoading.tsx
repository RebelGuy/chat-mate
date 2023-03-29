import { Box, CircularProgress } from '@mui/material'
import { RequestResult } from '@rebel/studio/hooks/useRequest'

type Props = {
  isLoading: boolean
} | {
  requestObj: RequestResult<any> | RequestResult<any>[]
  initialOnly?: boolean
}

export default function ApiLoading (props: Props) {
  let isLoading: boolean
  if ('isLoading' in props) {
    isLoading = props.isLoading
  } else {
    const objs = Array.isArray(props.requestObj) ? props.requestObj : [props.requestObj]

    // if we have data for all requests, don't show the loading spinner
    if (props.initialOnly && objs.find(o => o.data == null) == null) {
      return null
    }

    isLoading = objs.find(o => o.isLoading) != null
  }

  if (!isLoading) {
    return null
  }

  return (
    <Box sx={{ mt: 1, mb: 1, display: 'flex', alignItems: 'center' }}>
      <CircularProgress size="1rem" />
      <Box sx={{ display: 'inline', pl: 1 }}>Loading...</Box>
    </Box>
  )
}
