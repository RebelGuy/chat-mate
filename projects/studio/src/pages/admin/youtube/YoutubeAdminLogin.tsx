import { Button } from '@mui/material'
import ApiError from '@rebel/studio/components/ApiError'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import useRequest from '@rebel/studio/hooks/useRequest'
import { authoriseYoutubeAdmin, getAdministrativeMode, getYoutubeAdminLoginUrl, revokeYoutubeAdmin } from '@rebel/studio/utility/api'
import { ReactNode, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

export default function YoutubeAdminLogin () {
  const [params, setParams] = useSearchParams()

  // params are cleared upon mounting, but retained in state by setting them as the default value of each piece of state
  const code = params.get('code')
  const [showForm] = useState(code == null)

  const getAdministrativeModeRequest = useRequest(getAdministrativeMode())

  const getLoginUrlRequest = useRequest(getYoutubeAdminLoginUrl(), { onDemand: true })
  const authoriseYoutubeRequest = useRequest(authoriseYoutubeAdmin(code!), { onDemand: true })
  const revokeAccessRequest = useRequest(revokeYoutubeAdmin(), { onDemand: true })

  useEffect(() => {
    setParams({})

    if (code != null) {
      authoriseYoutubeRequest.triggerRequest()
    } else {
      getLoginUrlRequest.triggerRequest()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onLoginToYoutube = () => {
    if (getAdministrativeModeRequest.data?.isAdministrativeMode || window.confirm('Are you sure you want to re-authenticate Youtube? ChatMate is not in administrative mode.')) {
      window.location.href = getLoginUrlRequest.data!.url
    }
  }

  let contents: ReactNode
  if (showForm) {
    contents = <>
      <div>Click here to login to the Application owner's Youtube account (this should be user '{<b>{getLoginUrlRequest.data?.youtubeChannelName ?? '<loading>'}</b>}'). Once logged-in, you will be redirected to this page.</div>
      <div>If you are already logged into a different account, you will get the chance to select the correct account on the next screen.</div>
      <div>Please make sure you tick all permission checkboxes for ChatMate to work correctly.</div>
      <Button
        onClick={onLoginToYoutube}
        disabled={getLoginUrlRequest.isLoading || getLoginUrlRequest.data == null}
        sx={{ mt: 1 }}
      >
        {/* lol @ nbsp */}
        Login to Youtube via the&nbsp;{<b>{getLoginUrlRequest.data?.youtubeChannelName ?? '<loading>'}</b>}&nbsp;account
      </Button>
      <ApiLoading requestObj={getLoginUrlRequest} />
      <ApiError requestObj={getLoginUrlRequest} />

      <Button
        onClick={() => revokeAccessRequest.triggerRequest()}
        disabled={revokeAccessRequest.isLoading || revokeAccessRequest.data != null}
        sx={{ mt: 1 }}
      >
        Revoke ChatMate access to the &nbsp;{<b>{getLoginUrlRequest.data?.youtubeChannelName ?? '<loading>'}</b>}&nbsp;channel
      </Button>
      <ApiLoading requestObj={revokeAccessRequest} />
      <ApiError requestObj={revokeAccessRequest} />
    </>
  } else {
    contents = <>
      {authoriseYoutubeRequest.data != null && <div>Successfully updated Youtube access token. You may have to restart the server for changes to come into effect.</div>}
      <ApiLoading requestObj={authoriseYoutubeRequest}>Updating access token. Please wait...</ApiLoading>
      <ApiError requestObj={authoriseYoutubeRequest} />
    </>
  }

  return <>
    <PanelHeader>Update Youtube Access Token</PanelHeader>
    {contents}
  </>
}
