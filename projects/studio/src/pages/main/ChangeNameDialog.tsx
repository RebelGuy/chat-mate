import { nullIfEmpty } from '@rebel/shared/util/strings'
import { setDisplayName } from '@rebel/studio/utility/api'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { useContext, useState } from 'react'
import TextField from '@mui/material/TextField'
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import useRequest from '@rebel/studio/hooks/useRequest'
import ApiError from '@rebel/studio/components/ApiError'

type Props = {
  open: boolean
  onClose: () => void
}

export default function ChangeNameDialog (props: Props) {
  const loginContext = useContext(LoginContext)
  const [newDisplayName, setNewDisplayName] = useState(loginContext.displayName ?? '')

  const changeDisplayNameRequest = useRequest(setDisplayName({ displayName: nullIfEmpty(newDisplayName?.trim()) }), {
    onDemand: true,
    onSuccess: async () => {
      loginContext.setLogin(loginContext.username!, nullIfEmpty(newDisplayName?.trim()), loginContext.loginToken!, loginContext.isStreamer)

      if (loginContext.isStreamer) {
        await loginContext.refreshData('streamerList')
      }

      onClose()
    }
  })

  const validationError = newDisplayName.trim().length > 20 ? 'Name cannot be longer than 20 characters' : null
  const isLoading = changeDisplayNameRequest.isLoading || loginContext.isLoading
  const onSubmit = changeDisplayNameRequest.triggerRequest
  const onClose = () => {
    changeDisplayNameRequest.reset()
    props.onClose()
  }

  return (
    <Dialog open={props.open}>
      <DialogTitle>Change Name</DialogTitle>
      <DialogContent>
        <div style={{ width: 'fit-content', margin: 'auto' }}>
          <Box style={{ display: 'flex', flexDirection: 'column' }}>
            <TextField
              label="Username"
              type="text"
              disabled={true}
              sx={{ width: 350, mt: 2 }}
              value={loginContext.username}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Display name"
              type="text"
              disabled={isLoading}
              sx={{ width: 350, mt: 2 }}
              onChange={e => setNewDisplayName(e.target.value)}
              defaultValue={loginContext.displayName ?? ''}
              error={validationError != null}
              helperText={validationError}
            />
          </Box>
        </div>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Box>
          <ApiError requestObj={changeDisplayNameRequest} hideRetryButton />
        </Box>
        <Box>
          <Button
            type="submit"
            onClick={onSubmit}
            disabled={isLoading || validationError != null}
            sx={{ mr: 1 }}
          >
            {!isLoading ? 'OK' : <CircularProgress size="24px" />}
          </Button>
          <Button onClick={onClose}>
            Close
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  )
}
