import { Box, CircularProgress } from '@mui/material'
import { nonNull } from '@rebel/shared/util/arrays'
import { RequestResult } from '@rebel/studio/hooks/useRequest'
import { ReactNode } from 'react'

type Props = {
  // by default, renders "Loading...", unless children are provided.
  children?: ReactNode
} & ({
  isLoading: boolean
} | {
  requestObj: RequestResult<any> | (RequestResult<any> | null | undefined)[]
  isLoading?: boolean // optionally force the loading state
  initialOnly?: boolean
})

export default function ApiLoading (props: Props) {
  let isLoading: boolean
  if ('requestObj' in props) {
    if (props.isLoading) {
      isLoading = true
    } else {
      const objs = Array.isArray(props.requestObj) ? nonNull(props.requestObj) : [props.requestObj]

      // if we have data for all requests, don't show the loading spinner
      if (props.initialOnly && objs.find(o => o.data == null && o.error == null) == null) {
        return null
      }

      isLoading = objs.find(o => o.isLoading) != null
    }
  } else {
    isLoading = props.isLoading
  }

  if (!isLoading) {
    return null
  }

  return (
    <Box sx={{ mt: 1, mb: 1, display: 'flex', alignItems: 'center' }}>
      <CircularProgress size="1rem" />
      <Box sx={{ display: 'inline', pl: 1 }}>{props.children ?? 'Loading...'}</Box>
    </Box>
  )
}
