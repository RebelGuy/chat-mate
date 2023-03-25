import { Alert, Button } from '@mui/material'
import { ApiRequestError, RequestResult } from '@rebel/studio/hooks/useRequest'

type Props = {
  hideRetryButton?: boolean
} & ({
  error: ApiRequestError | null
  isLoading?: boolean
} | {
  requestObj: RequestResult<any>
})

export default function ApiError (props: Props) {
  const hideRetryButton = props.hideRetryButton ?? false
  let error: ApiRequestError | null
  let isLoading: boolean

  if ('error' in props) {
    error = props.error
    isLoading = props.isLoading ?? false
  } else {
    error = props.requestObj.error
    isLoading = props.requestObj.isLoading
  }

  if (error == null) {
    return null
  }

  const showRetryButton = !hideRetryButton && error.onRetry != null

  return (
    <Alert severity="error" sx={{ mt: 1, mb: 1 }} action={showRetryButton && (
      <Button disabled={isLoading} onClick={error.onRetry}>
        Retry
      </Button>
    )}>
      Error: {error.message}
    </Alert>
  )
}
