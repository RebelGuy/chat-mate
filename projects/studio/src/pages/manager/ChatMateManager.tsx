import { assertUnreachable } from '@rebel/shared/util/typescript'
import { getStatus, getStreamlabsStatus, setActiveLivestream, setStreamlabsSocketToken } from '@rebel/studio/utility/api'
import ApiRequest from '@rebel/studio/components/ApiRequest'
import ApiRequestTrigger from '@rebel/studio/components/ApiRequestTrigger'
import * as React from 'react'
import { EmptyObject } from '@rebel/shared/types'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'
import { Alert, Button, TextField } from '@mui/material'
import { Box } from '@mui/system'
import { getLiveId } from '@rebel/shared/util/text'
import CopyText from '@rebel/studio/components/CopyText'
import { ReactNode, useState } from 'react'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import useRequest from '@rebel/studio/hooks/useRequest'
import { isNullOrEmpty, nullIfEmpty } from '@rebel/shared/util/strings'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'

export default function ChatMateManager () {
  const [currentLivestreamInput, setCurrentLivestreamInput] = useState('')
  const [lastLivestreamResponse, setLastLivestreamResponse] = useState('')
  const [currentSocketInput, setCurrentSocketInput] = useState('')
  const [socketMessage, setSocketMessage] = useState<string | null>(null)

  const [livestreamKey, updateLivestreamKey] = useUpdateKey()
  const [socketKey, updateSocketKey] = useUpdateKey({ repeatInterval: 5000 })

  const getStatusRequest = useRequest(getStatus(), {
    updateKey: livestreamKey,
    onSuccess: (data) => {
      setCurrentLivestreamInput(data.livestreamStatus?.livestream.livestreamLink ?? '')
      setLastLivestreamResponse(data.livestreamStatus?.livestream.livestreamLink ?? '')
    }, onError: () => {
      setCurrentLivestreamInput(currentLivestreamInput)
      setLastLivestreamResponse('')
    }
  })
  const setLivestreamRequest = useRequest(setActiveLivestream({ livestream: nullIfEmpty(currentLivestreamInput) }), { onDemand: true })

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

  let livestreamIdError: string | null = null
  if (currentLivestreamInput.length > 0) {
    try {
      getLiveId(currentLivestreamInput)
    } catch (e: any) {
      livestreamIdError = 'Invalid livestream ID or URL'
    }
  }

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

  return <div style={{ display: 'block' }}>
    <PanelHeader>Active Livestream {<RefreshButton isLoading={getStatusRequest.isLoading} onRefresh={updateLivestreamKey} />}</PanelHeader>
    <div>Set the active YouTube livestream that ChatMate should listen to.</div>
    <Box style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      <TextField
        value={currentLivestreamInput}
        label="YouTube livestream ID or URL"
        disabled={getStatusRequest.isLoading || setLivestreamRequest.isLoading}
        style={{ width: 400 }}
        helperText={livestreamIdError}
        error={livestreamIdError != null}
        onChange={(e) => setCurrentLivestreamInput(e.target.value)}
      />
      {currentLivestreamInput.length > 0 && livestreamIdError == null && (
        <CopyText
          text={currentLivestreamInput}
          tooltip="Copy livestream URL"
          sx={{ ml: 1 }}
        />
      )}
    </Box>
    <Button
      disabled={getStatusRequest.isLoading || setLivestreamRequest.isLoading || livestreamIdError != null || lastLivestreamResponse === currentLivestreamInput}
      sx={{ display: 'block', mt: 1 }}
      onClick={setLivestreamRequest.triggerRequest}
    >
      {currentLivestreamInput.length === 0 ? 'Clear' : 'Set'} active livestream
    </Button>
    <ApiLoading requestObj={[getStatusRequest, setLivestreamRequest]} initialOnly={!setLivestreamRequest.isLoading} />
    <ApiError requestObj={[getStatusRequest, setLivestreamRequest]} />

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
    <TextField
      value={currentSocketInput}
      label="Socket token"
      disabled={setStreamlabsSocketTokenRequest.isLoading}
      style={{ width: 400 }}
      onChange={(e) => setCurrentSocketInput(e.target.value)}
    />
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
  </div>
}
