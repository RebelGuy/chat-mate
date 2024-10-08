import { PublicStreamerApplication } from '@rebel/api-models/public/user/PublicStreamerApplication'
import { GetApplicationsResponse } from '@rebel/api-models/schema/streamer'
import { sortBy } from '@rebel/shared/util/arrays'
import { capitaliseWord } from '@rebel/shared/util/text'
import { approveStreamerApplication, createStreamerApplication, getStreamerApplications, rejectStreamerApplication, withdrawStreamerApplication } from '@rebel/studio/utility/api'
import RequireRank from '@rebel/studio/components/RequireRank'
import * as React from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { PageLink } from '@rebel/studio/pages/navigation'
import TextWithNewlines from '@rebel/studio/components/TextWithNewlines'
import useRequest, { ApiRequestError } from '@rebel/studio/hooks/useRequest'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import LinkToPage from '@rebel/studio/components/LinkToPage'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'

export default function ApplyForStreamer () {
  const [updateKey, setUpdateKey] = React.useState(Date.now())
  const { data, isLoading, error } = useRequest(getStreamerApplications(), { updateKey })

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
  const createApplicationRequest = useRequest(createStreamerApplication({ message }), {
    onDemand: true,
    onSuccess: () => {
      props.onApplicationCreated()
      setMessage('')
    }
  })

  return <>
    <Typography mb={1}>Use the form to request participation in the ChatMate Beta Program.</Typography>
    <Typography mb={1}>Once accepted, you will be able to indicate your primary YouTube and/or Twitch channel on the <LinkToPage page={PageLink} label={PageLink.title} /> page. For more information, check out the <LinkInNewTab href="https://github.com/RebelGuy/chat-mate/blob/master/docs/streamer-guide.md">Streamer Guide</LinkInNewTab>.</Typography>
    <Typography>Please note that ChatMate is currently in its early stages of public testing, and be aware of the following limitations:</Typography>
    <ul>
      <li>The ChatMate Minecraft integration is currently only available for Minecraft 1.8.9 - please refer to the <LinkInNewTab href="https://github.com/RebelGuy/chat-mate-client/blob/master/docs/streamer-guide.md">Streamer Guide (Minecraft Mod)</LinkInNewTab> for more details.</li>
      <li>Bugs may be present and some features are not yet fully fledged out. The ChatMate experience is likely to change in the future.</li>
      <li>I am happy to work with you to add new features to ChatMate.</li>
      <li>If you have any questions at all, contact <code>rebel_guy</code> on Discord.</li>
    </ul>
    <Box>
      <TextField
        value={message}
        multiline
        rows={5}
        label={props.disabledMessage ?? 'Type your message here. Ensure you provide contact details.'}
        disabled={props.disabled || createApplicationRequest.isLoading}
        style={{ width: '100%' }}
        onChange={e => setMessage(e.target.value)}
      />
      <Button
        disabled={props.disabled || createApplicationRequest.isLoading}
        sx={{ mt: 1 }}
        onClick={createApplicationRequest.triggerRequest}
      >
        Submit
      </Button>
      <ApiLoading requestObj={createApplicationRequest} />
      <ApiError requestObj={createApplicationRequest} />
    </Box>
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
    <PanelHeader>
      Applications {<RefreshButton isLoading={props.isLoading} onRefresh={props.onApplicationUpdated} />}
    </PanelHeader>
  )

  if (props.data != null && props.data.streamerApplications.length === 0) {
    return <>
      {header}
      <div>
        There are no applications to show. Create a new one using the above input field.
      </div>
    </>
  }

  return (
    <>
      {header}
      {props.data == null && props.error == null && <ApiLoading isLoading={props.isLoading} />}
      <ApiError error={props.error} isLoading={props.isLoading} />

      {props.data && (
        <Table size="small" style={{ maxWidth: 1200 }}>
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
            <ApplicationActions
              application={viewingApplication}
              isLoading={props.isLoading}
              onApplicationUpdated={props.onApplicationUpdated}
            />
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
  isLoading: boolean
  onApplicationUpdated: () => void
}

function ApplicationActions (props: ApplicationActionProps) {
  const withdrawRequest = useRequest(withdrawStreamerApplication({ message: 'Withdrawn by user' }, props.application.id), {
    onDemand: true,
    onSuccess: props.onApplicationUpdated
  })
  const approveRequest = useRequest(approveStreamerApplication({ message: 'Approved by admin' }, props.application.id), {
    onDemand: true,
    onSuccess: props.onApplicationUpdated
  })
  const rejectRequest = useRequest(rejectStreamerApplication({ message: 'Rejected by admin' }, props.application.id), {
    onDemand: true,
    onSuccess: props.onApplicationUpdated
  })

  if (props.application.status !== 'pending') {
    return null
  }

  const normalContent = (
    <>
      <Button
        onClick={withdrawRequest.triggerRequest}
        disabled={props.isLoading || withdrawRequest.isLoading}
        sx={{ mr: 1 }}
      >
        Withdraw
      </Button>
      <ApiError requestObj={withdrawRequest} />
    </>
  )

  return (
    <RequireRank admin hideAdminOutline forbidden={normalContent}>
      <div>
        <Button
          onClick={approveRequest.triggerRequest}
          disabled={props.isLoading || approveRequest.isLoading}
          sx={{ mr: 1 }}
        >
          Approve
        </Button>

        <Button
          onClick={rejectRequest.triggerRequest}
          disabled={props.isLoading || rejectRequest.isLoading}
          sx={{ mr: 1 }}
        >
          Reject
        </Button>

        <ApiError requestObj={approveRequest} />
        <ApiError requestObj={rejectRequest} />
      </div>
    </RequireRank>
  )
}
