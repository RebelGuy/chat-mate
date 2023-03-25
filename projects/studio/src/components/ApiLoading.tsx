import { Box, CircularProgress } from '@mui/material'
import { RequestResult } from '@rebel/studio/hooks/useRequest'

type Props = {
  isLoading: boolean
} | {
  requestObj: RequestResult<any>
}

export default function ApiLoading (props: Props) {
  const isLoading = 'isLoading' in props ? props.isLoading : props.requestObj.isLoading
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
