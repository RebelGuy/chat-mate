import { Alert, Button } from '@mui/material'
import ApiError from '@rebel/studio/components/ApiError'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import useRequest from '@rebel/studio/hooks/useRequest'
import { authoriseTwitch, getTwitchLoginUrl } from '@rebel/studio/utility/api'
import { ReactNode, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

export default function TwitchAdminLogin () {
  const [params, setParams] = useSearchParams()

  // params are cleared upon mounting, but retained in state by setting them as the default value of each piece of state
  const code = params.get('code')
  const [requiresLogin] = useState(code == null)
  const [error] = useState<string | null>(params.get('error'))
  const [errorDescription] = useState<string | null>(params.get('error_description'))

  const getLoginUrlRequest = useRequest(getTwitchLoginUrl(), { onDemand: true })
  const authoriseTwitchRequest = useRequest(authoriseTwitch(code ?? ''), { onDemand: true })

  useEffect(() => {
    setParams({})

    if (code != null) {
      authoriseTwitchRequest.triggerRequest()
    } else {
      getLoginUrlRequest.triggerRequest()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  let contents: ReactNode
  if (requiresLogin) {
    contents = <>
      <div>Click here to login to the Application owner's Twitch account. Once logged-in, you will be redirected to this page.</div>
      <div>If you are already logged into a different account, you may have to open this in an incognito window.</div>
      <Button
        href={getLoginUrlRequest.data?.url}
        disabled={getLoginUrlRequest.isLoading}
        sx={{ mt: 1 }}
      >
        Login to Twitch
      </Button>
      <ApiLoading requestObj={getLoginUrlRequest} />
      <ApiError requestObj={getLoginUrlRequest} />
    </>
  } else {
    contents = <>
      {authoriseTwitchRequest.data != null && <div>Successfully updated Twitch access token. You may now close this page.</div>}
      <ApiLoading requestObj={authoriseTwitchRequest}>Updating access token. Please wait...</ApiLoading>
      <ApiError requestObj={authoriseTwitchRequest} />
    </>
  }

  return <>
    <PanelHeader>Update Twitch Access Token</PanelHeader>
    {(error != null || errorDescription != null) &&
      <Alert severity="error" sx={{ mb: 1 }}>
        {`${error}: ${errorDescription}`}
      </Alert>
    }
    {contents}
  </>
}
