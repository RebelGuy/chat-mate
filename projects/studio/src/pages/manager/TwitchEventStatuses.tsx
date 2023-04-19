import { Close, Done, Error } from '@mui/icons-material'
import { CircularProgress, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Tooltip } from '@mui/material'
import { PublicTwitchEventStatus } from '@rebel/server/controllers/public/streamer/PublicTwitchEventStatus'
import ApiError from '@rebel/studio/components/ApiError'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import useRequest from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { getTwitchEventStatuses } from '@rebel/studio/utility/api'

type EventInfo = {
  name: string
  description: string
}

const EVENT_INFO: Record<PublicTwitchEventStatus['eventType'], EventInfo> = {
  chat: {
    name: 'Chat',
    description: `ChatMate joins your Twitch channel's chat to listen to messages from other users and perform some moderation actions.`
  },
  followers: {
    name: 'New Followers',
    description: 'ChatMate listens to new followers to your channel to show you notifications.'
  }
}

export default function TwitchEventStatuses () {
  const [refreshToken, updateRefreshToken] = useUpdateKey()
  const getStatusesRequest = useRequest(getTwitchEventStatuses(), { updateKey: refreshToken })

  return <>
    <PanelHeader>Twitch Events {<RefreshButton isLoading={getStatusesRequest.isLoading} onRefresh={updateRefreshToken} />}</PanelHeader>
    <ApiLoading requestObj={getStatusesRequest} />
    <ApiError requestObj={getStatusesRequest} />

    {getStatusesRequest.data != null && <>
      <div>
        The following shows the current status of each Twitch event subscription.
        Most of the communication with Twitch is established via these events.
        As such, ChatMate may not work correctly if any of the subscriptions are broken.
      </div>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Event Name</TableCell>
            <TableCell>Info</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {getStatusesRequest.data.statuses.map((status, i) => <StatusRow key={i} status={status} />)}
        </TableBody>
      </Table>
    </>}
  </>
}

type StatusProps = {
  status: PublicTwitchEventStatus
}

function StatusRow (props: StatusProps) {
  const type = props.status.eventType
  const status = props.status.status
  const errorMessage = props.status.errorMessage

  let statusIcon: React.ReactNode
  let tooltip: string
  if (status === 'active') {
    statusIcon = <Done color="success" />
    tooltip = 'Subscription is active.'
  } else if (status === 'pending') {
    statusIcon = <CircularProgress size="1rem" />
    tooltip = 'Subscription is being created - please wait a few seconds.'
  } else if (errorMessage == null) {
    statusIcon = <Close color="warning" />
    tooltip = 'Subscription is not active.'
  } else {
    statusIcon = <Error color="error" />
    tooltip = errorMessage
  }

  return (
    <TableRow>
      <TableCell>{EVENT_INFO[type].name}</TableCell>
      <TableCell>{EVENT_INFO[type].description}</TableCell>
      <TableCell>
        <Tooltip title={tooltip}>
          <IconButton>
            {statusIcon}
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  )
}
