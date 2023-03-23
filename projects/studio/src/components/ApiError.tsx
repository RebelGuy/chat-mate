import { Alert, Button } from '@mui/material'
import { ApiRequestError } from '@rebel/studio/hooks/useRequest'

type Props = {
  error: ApiRequestError | null
  hideRetryButton?: boolean
}

export default function ApiError (props: Props) {
  if (props.error == null) {
    return null
  }

  return (
    <Alert severity="error" action={!props.hideRetryButton && props.error.onRetry != null && <Button onClick={props.error.onRetry}>Retry</Button>}>
      Error: {props.error.message}
    </Alert>
  )
}
