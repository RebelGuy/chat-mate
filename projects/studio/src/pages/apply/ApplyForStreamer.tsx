import { ApiResponse } from '@rebel/server/controllers/ControllerBase'
import { PublicStreamerApplication } from '@rebel/server/controllers/public/user/PublicStreamerApplication'
import { GetApplicationsResponse } from '@rebel/server/controllers/StreamerController'
import { sortBy } from '@rebel/shared/util/arrays'
import { capitaliseWord } from '@rebel/shared/util/text'
import { approveStreamerApplication, createStreamerApplication, rejectStreamerApplication, withdrawStreamerApplication } from '@rebel/studio/utility/api'
import ApiRequestTrigger from '@rebel/studio/components/ApiRequestTrigger'
import RequireRank from '@rebel/studio/components/RequireRank'
import * as React from 'react'
import { Refresh } from '@mui/icons-material'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Table, TableBody, TableCell, TableHead, TableRow, TextField } from '@mui/material'
import { PageLink } from '@rebel/studio/pages/navigation'
import TextWithNewlines from '@rebel/studio/components/TextWithNewlines'
import useRequest, { ApiRequestError } from '@rebel/studio/hooks/useRequest'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'

export default function ApplyForStreamer () {
  const [updateKey, setUpdateKey] = React.useState(Date.now())
  const { data, isLoading, error } = useRequest<GetApplicationsResponse>('/streamer/application', { updateKey })

  const regenerateUpdateKey = () => setUpdateKey(Date.now())

  return (
    <>
      <RequireRank anyOwner inverted>
        <ApplicationForm
          disabled={data?.streamerApplications.find(app => app.status === 'pending') != null}
          disabledMessage={data?.streamerApplications.find(app => app.status === 'pending') != null ? 'You already have an application pending.' : null}
          onApplicationCreated={regenerateUpdateKey}
        />
      </RequireRank>
      <ApplicationHistory data={data} isLoading={isLoading} error={error} onApplicationUpdated={regenerateUpdateKey} />
    </>
  )
}

type ApplicationFormProps = {
  disabled: boolean
  disabledMessage: string | null
  onApplicationCreated: () => void
}

function ApplicationForm (props: ApplicationFormProps) {
  const [message, setMessage] = React.useState('')

  const onCreateApplication = async (loginToken: string) => {
    const result = await createStreamerApplication(loginToken, message)
    if (result.success) {
      props.onApplicationCreated()
      setMessage('')
    }
    return result
  }

  return <>
    <div>Use the form to request participation in the ChatMate Beta Program.</div>
    <div>Once accepted, you will be able to indicate your primary YouTube and/or Twitch channel on the <b>{PageLink.title}</b> page.</div>
    <ApiRequestTrigger onRequest={onCreateApplication}>
      {(onMakeRequest, responseData, loadingNode, errorNode) => (
        <Box>
          <TextField
            value={message}
            multiline
            rows={5}
            label={props.disabledMessage ?? 'Type your message here'}
            disabled={props.disabled || loadingNode != null}
            style={{ width: '100%' }}
            onChange={e => setMessage(e.target.value)}
          />
          <Button
            disabled={props.disabled || loadingNode != null}
            sx={{ mt: 1 }}
            onClick={onMakeRequest}
          >
            Submit
          </Button>
          {loadingNode}
          {errorNode}
        </Box>
      )}
    </ApiRequestTrigger>
  </>
}

type ApplicationHistoryProps = {
  data: Extract<GetApplicationsResponse, { success: true }>['data'] | null
  isLoading: boolean
  error: ApiRequestError | null
  onApplicationUpdated: () => void
}

function ApplicationHistory (props: ApplicationHistoryProps) {
  const [viewingApplicationId, setViewingApplicationId] = React.useState<number | null>(null)
  const viewingApplication = props.data?.streamerApplications.find(app => app.id === viewingApplicationId) ?? null

  const header = (
    <h3>Applications {<IconButton onClick={props.onApplicationUpdated}><Refresh /></IconButton>}</h3>
  )

  if (props.data != null && props.data.streamerApplications.length === 0) {
    return <>
      {header}
      <div>
        There are no applications to show. Create a new one using the below input field.
      </div>
    </>
  }

  return (
    <>
      {header}
      {props.data && (
        <Table style={{ width: '100%', maxWidth: 800, margin: 'auto' }}>
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell>Date Submitted</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Response</TableCell>
              <TableCell>Date Closed</TableCell>
              <TableCell>{/* view button column */}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortBy(props.data.streamerApplications, app => app.timeCreated, 'desc').map(app =>
              <ApplicationRow
                key={app.id}
                application={app}
                onApplicationUpdated={props.onApplicationUpdated}
                onViewApplication={() => setViewingApplicationId(app.id)}
              />
            )}
          </TableBody>
        </Table>
      )}
      <ApiLoading isLoading={props.isLoading} />
      <ApiError error={props.error} />

      <Dialog open={viewingApplication != null}>
        <DialogTitle>
          Application by {viewingApplication?.username}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            <TextWithNewlines text={viewingApplication?.message ?? ''} component="span" />
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          {viewingApplication != null &&
            <ApplicationActions application={viewingApplication} onApplicationUpdated={props.onApplicationUpdated} />
          }
          <Button onClick={() => setViewingApplicationId(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

type ApplicationRowProps = {
  application: PublicStreamerApplication
  onApplicationUpdated: () => void
  onViewApplication: () => void
}

function ApplicationRow (props: ApplicationRowProps) {
  return (
    <TableRow>
      <TableCell>{capitaliseWord(props.application.status)}</TableCell>
      <TableCell>{new Date(props.application.timeCreated).toLocaleString()}</TableCell>
      <TableCell>{props.application.username}</TableCell>
      <TableCell>{props.application.closeMessage}</TableCell>
      <TableCell>{props.application.timeClosed != null && new Date(props.application.timeClosed).toLocaleString()}</TableCell>
      <TableCell><Button onClick={props.onViewApplication}>View</Button></TableCell>
    </TableRow>
  )
}

type ApplicationActionProps = {
  application: PublicStreamerApplication
  onApplicationUpdated: () => void
}

function ApplicationActions (props: ApplicationActionProps) {
  if (props.application.status !== 'pending') {
    return null
  }

  const onRequestDone = <T extends ApiResponse<any>>(response: T) => {
    if (response.success) {
      props.onApplicationUpdated()
    }
    return response
  }

  const normalContent = (
    <ApiRequestTrigger
      onRequest={(loginToken) => withdrawStreamerApplication(loginToken, props.application.id, 'Withdrawn by user').then(onRequestDone)}
    >
      {(onMakeRequest, response, loadingNode, errorNode) => <>
        <Button
          onClick={onMakeRequest}
          disabled={loadingNode != null}
          sx={{ mr: 1 }}
        >
          Withdraw
        </Button>
        {errorNode}
      </>}
    </ApiRequestTrigger>
  )

  return (
    <RequireRank admin hideAdminOutline forbidden={normalContent}>
      <div>
        <ApiRequestTrigger
          onRequest={(loginToken) => approveStreamerApplication(loginToken, props.application.id, 'Approved by admin').then(onRequestDone)}
        >
          {(onMakeRequest, response, loadingNode, errorNode) => <>
            <Button
              onClick={onMakeRequest}
              disabled={loadingNode != null}
              sx={{ mr: 1 }}
            >
              Approve
            </Button>
            {errorNode}
          </>}
        </ApiRequestTrigger>
        <ApiRequestTrigger
          onRequest={(loginToken) => rejectStreamerApplication(loginToken, props.application.id, 'Rejected by admin').then(onRequestDone)}
        >
          {(onMakeRequest, response, loadingNode, errorNode) => <>
            <Button
              onClick={onMakeRequest}
              disabled={loadingNode != null}
              sx={{ mr: 1 }}
            >
              Reject
            </Button>
            {errorNode}
          </>}
        </ApiRequestTrigger>
      </div>
    </RequireRank>
  )
}
