import { assertUnreachable } from '@rebel/shared/util/typescript'
import { getStreamlabsStatus, setStreamlabsSocketToken } from '@rebel/studio/utility/api'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'
import { Alert, Button, TextField } from '@mui/material'
import { Box } from '@mui/system'
import { ReactNode, useState } from 'react'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import useRequest from '@rebel/studio/hooks/useRequest'
import { isNullOrEmpty, nullIfEmpty } from '@rebel/shared/util/strings'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'

export default function StreamlabsWebsocketForm () {
  const [currentSocketInput, setCurrentSocketInput] = useState('')
  const [socketMessage, setSocketMessage] = useState<string | null>(null)

  const [socketKey, updateSocketKey] = useUpdateKey({ repeatInterval: 5000 })

  const getStreamlabsStatusRequest = useRequest(getStreamlabsStatus(), { updateKey: socketKey })
  const setStreamlabsSocketTokenRequest = useRequest(setStreamlabsSocketToken({ websocketToken: nullIfEmpty(currentSocketInput) }), {
    onDemand: true,
    onRequest: () => setSocketMessage(null),
    onSuccess: (data) => {
      const socket = nullIfEmpty(currentSocketInput)
      let newSocketMessage: string
      if (socket == null && data.result === 'success') {
        newSocketMessage = 'Removed socket token. You are no longer listening to StreamLabs donations.'
      } else if (socket == null && data.result === 'noChange') {
        newSocketMessage = 'Could not find a token to remove. You are not listening to StreamLabs donations.'
      } else if (data.result === 'success') {
        newSocketMessage = 'Added socket token. You are now listening to StreamLabs donations.'
      } else if (data.result === 'noChange') {
        newSocketMessage = 'Token already exists. You are still listening to StreamLabs donations.'
      } else {
        assertUnreachable(data.result)
      }

      setCurrentSocketInput('')
      setSocketMessage(newSocketMessage)
    }
  })


  let donationsSection: ReactNode
  if (getStreamlabsStatusRequest.data != null) {
    if (getStreamlabsStatusRequest.data.status === 'listening') {
      donationsSection = <div>ChatMate is <b style={{ color: 'green' }}>listening</b> to your Streamlabs donations.</div>
    } else if (getStreamlabsStatusRequest.data.status === 'notListening') {
      donationsSection = <div>ChatMate is <b style={{ color: 'red' }}>not listening</b> to your Streamlabs donations. You can set the socket token below to start listening.</div>
    } else if (getStreamlabsStatusRequest.data.status === 'error') {
      donationsSection = <div>Looks like something went wrong, and ChatMate is probably <b style={{ color: 'red' }}>not listening</b> to your Streamlabs donations. <br />
        It is recommendd that you reset the socket token below.</div>
    } else {
      assertUnreachable(getStreamlabsStatusRequest.data.status)
    }
  }

  return <>
    <PanelHeader>Donations {<RefreshButton isLoading={getStreamlabsStatusRequest.isLoading} onRefresh={updateSocketKey} />}</PanelHeader>
    <div style={{ marginTop: 4, marginBottom: 4 }}>
      {donationsSection}
      <ApiLoading requestObj={getStreamlabsStatusRequest} initialOnly />
      <ApiError requestObj={getStreamlabsStatusRequest} />
    </div>

    <div>
      Set the StreamLabs socket token to listen for donations. If the token field is left blank, ChatMate will stop listening to donations.<br />
      You can get your StreamLabs socket token by going to {<LinkInNewTab href="https://streamlabs.com/dashboard#/settings/api-settings">your dashboard</LinkInNewTab>} -&gt; API Tokens tab -&gt; copying the Socket API Token.
    </div>
    <Box style={{ display: 'flex' }}>
      <TextField
        value={currentSocketInput}
        label="Socket token"
        disabled={setStreamlabsSocketTokenRequest.isLoading}
        style={{ width: 500 }}
        onChange={(e) => setCurrentSocketInput(e.target.value)}
      />
    </Box>
    <Button
      disabled={setStreamlabsSocketTokenRequest.isLoading}
      sx={{ display: 'block', mt: 1 }}
      onClick={setStreamlabsSocketTokenRequest.triggerRequest}
    >
      {currentSocketInput.length === 0 ? 'Clear' : 'Set'} token
    </Button>
    <ApiLoading requestObj={setStreamlabsSocketTokenRequest} />
    <ApiError requestObj={setStreamlabsSocketTokenRequest} />
    {!isNullOrEmpty(socketMessage) && <Alert severity="info" sx={{ mt: 1 }}>{socketMessage}</Alert>}
  </>
}
