import { Close, Done } from '@mui/icons-material'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { PublicLinkAttemptLog } from '@rebel/api-models/public/user/PublicLinkAttemptLog'
import { sortBy } from '@rebel/shared/util/arrays'
import { toSentenceCase } from '@rebel/shared/util/text'
import ApiError from '@rebel/studio/components/ApiError'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import TimeSpan from '@rebel/studio/components/Timespan'
import useRequest from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { getLinkAttemptLogs, releaseLinkAttempt } from '@rebel/studio/utility/api'
import { useState } from 'react'

export default function LinkAttemptLogs () {
  const [viewingLogDetails, setViewingLogDetails] = useState<PublicLinkAttemptLog | null>(null)
  const [key, updateKey] = useUpdateKey()
  const getLogsRequest = useRequest(getLinkAttemptLogs(), { updateKey: key })

  return <>
    <PanelHeader>Link Attempt Logs {<RefreshButton isLoading={getLogsRequest.isLoading} onRefresh={updateKey} />}</PanelHeader>

    <ApiLoading requestObj={getLogsRequest} initialOnly />
    <ApiError requestObj={getLogsRequest} />
    {getLogsRequest.data != null && <>
      <Table
        stickyHeader
        sx={{ width: '100%', transform: 'translateY(-5px)' }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Id</TableCell>
            <TableCell>Start Time</TableCell>
            <TableCell>Duration</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Error</TableCell>
            <TableCell>Default User</TableCell>
            <TableCell>Aggregate User</TableCell>
            <TableCell>Link Token</TableCell>
            <TableCell>Released</TableCell>
            <TableCell>Details</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortBy(getLogsRequest.data.logs, l => l.startTime, 'desc').map((log, i) => <LinkAttemptLog key={i} log={log} onViewDetails={setViewingLogDetails} />)}
        </TableBody>
      </Table>
    </>}

    {viewingLogDetails != null && <>
      <Dialog open maxWidth="md">
        <DialogTitle>Details for link attempt {viewingLogDetails.id}</DialogTitle>
        <DialogContent><Details log={viewingLogDetails} onRefreshLogs={updateKey} /></DialogContent>
        <DialogActions>
          <Button onClick={() => setViewingLogDetails(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>}
  </>
}

type LinkAttemptLogProps = {
  log: PublicLinkAttemptLog
  onViewDetails: (log: PublicLinkAttemptLog) => void
}

function LinkAttemptLog (props: LinkAttemptLogProps) {
  const { log, onViewDetails } = props
  const isError = log.errorMessage != null

  return <>
    <TableRow sx={{ backgroundColor: isError ? 'rgba(255, 0, 0, 0.2)' : undefined }}>
      <TableCell>{log.id}</TableCell>
      <TableCell>{new Date(log.startTime).toLocaleString()}</TableCell>
      <TableCell>{log.endTime != null ? <TimeSpan start={log.startTime} end={log.endTime} allowMs /> : <i>In progress</i>}</TableCell>
      <TableCell>{toSentenceCase(log.type)}</TableCell>
      <TableCell>{log.errorMessage}</TableCell>
      <TableCell>{log.defaultChatUserId}</TableCell>
      <TableCell>{log.aggregateChatUserId}</TableCell>
      <TableCell>{log.linkToken ?? 'n/a'}</TableCell>
      <TableCell>{log.released ? <Done /> : <Close color="error" />}</TableCell>
      <TableCell><Button onClick={() => onViewDetails(log)}>{log.steps.length} {log.steps.length === 1 ? 'step' : 'steps'}</Button></TableCell>
    </TableRow>
  </>
}

type DetailsProps = {
  log: PublicLinkAttemptLog
  onRefreshLogs: () => void
}

function Details (props: DetailsProps) {
  const { log, onRefreshLogs } = props
  const releaseRequest = useRequest(releaseLinkAttempt(log.id), { onDemand: true, onSuccess: onRefreshLogs })

  return <>
    {!log.released && releaseRequest.data == null && <>
      <Alert severity="error">This link attempt is not released. It encountered an error: {log.errorMessage}</Alert>
      <Button onClick={releaseRequest.triggerRequest} disabled={releaseRequest.isLoading} sx={{ mt: 2 }}>Release</Button>

      <ApiLoading requestObj={releaseRequest} />
      <ApiError requestObj={releaseRequest} />
    </>}

    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Step</TableCell>
          <TableCell>Duration (ms)<br /><Typography variant="caption">(since last step)</Typography></TableCell>
          <TableCell>Description</TableCell>
          <TableCell>Warnings</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {props.log.steps.map((step, i) => <TableRow key={i}>
          <TableCell>{i + 1}</TableCell>
          <TableCell>{i === 0 ? step.timestamp - log.startTime : step.timestamp - log.steps[i - 1].timestamp}</TableCell>
          <TableCell>{step.description}</TableCell>
          <TableCell>{i === 0 ? step.accumulatedWarnings : step.accumulatedWarnings - log.steps[i - 1].accumulatedWarnings}</TableCell>
        </TableRow>)}
      </TableBody>
    </Table>
  </>
}
