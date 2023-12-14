import { getStatus, setActiveLivestream } from '@rebel/studio/utility/api'
import { Button, TextField } from '@mui/material'
import { Box } from '@mui/system'
import { getLiveId } from '@rebel/shared/util/text'
import CopyText from '@rebel/studio/components/CopyText'
import { useState } from 'react'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import useRequest from '@rebel/studio/hooks/useRequest'
import { nullIfEmpty } from '@rebel/shared/util/strings'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'

export default function YoutubeLivestreamForm () {
  const [currentLivestreamInput, setCurrentLivestreamInput] = useState('')
  const [lastLivestreamResponse, setLastLivestreamResponse] = useState('')
  const [livestreamKey, updateLivestreamKey] = useUpdateKey()

  const getStatusRequest = useRequest(getStatus(), {
    updateKey: livestreamKey,
    onSuccess: (data) => {
      setCurrentLivestreamInput(data.livestreamStatus?.youtubeLivestream?.livestreamLink ?? '')
      setLastLivestreamResponse(data.livestreamStatus?.youtubeLivestream?.livestreamLink ?? '')
    }, onError: () => {
      setCurrentLivestreamInput(currentLivestreamInput)
      setLastLivestreamResponse('')
    }
  })
  const setLivestreamRequest = useRequest(setActiveLivestream({ livestream: nullIfEmpty(currentLivestreamInput) }), {
    onDemand: true,
    onSuccess: () => {
      setLastLivestreamResponse(currentLivestreamInput.trim())
      updateLivestreamKey()
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

  return <>
    <PanelHeader>Active Livestream {<RefreshButton isLoading={getStatusRequest.isLoading} onRefresh={updateLivestreamKey} />}</PanelHeader>
    <div>Set the active YouTube livestream that ChatMate should listen to.</div>
    <Box style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      <TextField
        value={currentLivestreamInput}
        label="YouTube livestream ID or URL"
        disabled={getStatusRequest.isLoading || setLivestreamRequest.isLoading}
        style={{ width: 500 }}
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
    <ApiLoading requestObj={getStatusRequest} initialOnly />
    <ApiLoading requestObj={setLivestreamRequest} />
    <ApiError requestObj={[getStatusRequest, setLivestreamRequest]} />


  </>
}
