import { Close, Done, Error } from '@mui/icons-material'
import { Alert, Button, CircularProgress, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Tooltip } from '@mui/material'
import { PublicTwitchEventStatus } from '@rebel/server/controllers/public/streamer/PublicTwitchEventStatus'
import ApiError from '@rebel/studio/components/ApiError'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import RelativeTime from '@rebel/studio/components/RelativeTime'
import RequireRank from '@rebel/studio/components/RequireRank'
import useRequest from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { getPrimaryChannels, getTwitchEventStatuses, getTwitchStreamerLoginUrl, reconnectChatClient } from '@rebel/studio/utility/api'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

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

let successPoller: number | null = null

export default function TwitchEventStatuses () {
  const [params, setParams] = useSearchParams()
  const [refreshToken, updateRefreshToken] = useUpdateKey()
  const getStatusesRequest = useRequest(getTwitchEventStatuses(), { updateKey: refreshToken })
  const reconnectChatClientRequest = useRequest(reconnectChatClient(), { onDemand: true })
  const primaryChannelsRequest = useRequest(getPrimaryChannels(), { onDemand: true })
  const getLoginUrlRequest = useRequest(getTwitchStreamerLoginUrl(), { onDemand: true })

  const code = params.get('code')
  const [isAuthSuccess] = useState(code != null)
  const [error] = useState<string | null>(params.get('error'))
  const [errorDescription] = useState<string | null>(params.get('error_description'))

  // it is not an error for the user to unnecessarily re-authenticate, but it's a nicer user experience if the button only shows when authentication is actually required
  const requiresAuth = getStatusesRequest.data == null || getStatusesRequest.data.statuses.find(requiresAuthentication) != null

  useEffect(() => {
    if (requiresAuth) {
      primaryChannelsRequest.triggerRequest()
      getLoginUrlRequest.triggerRequest()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiresAuth])

  // if the user authorised successfully, it may take a few seconds for events to re-subscribe. poll the server until we are in the clear
  useEffect(() => {
    if (isAuthSuccess && requiresAuth) {
      // what the fuck is eslint on about
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      successPoller = window.setInterval(updateRefreshToken, 2000)

      // if we take longer than this then something probably went wrong and we don't want to keep polling
      window.setTimeout(() => window.clearTimeout(successPoller!), 10000)
    } else if (isAuthSuccess && !requiresAuth) {
      setParams({})
      window.clearTimeout(successPoller!)
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthSuccess, requiresAuth])

  const onLoginToTwitch = () => {
    window.location.href = getLoginUrlRequest.data!.url
  }

  return <>
    <PanelHeader>Twitch Events {<RefreshButton isLoading={getStatusesRequest.isLoading} onRefresh={updateRefreshToken} />}</PanelHeader>
    <ApiLoading requestObj={getStatusesRequest} initialOnly />
    <ApiError requestObj={getStatusesRequest} />

    {/* Show the Twitch auth error */}
    {(error != null || errorDescription != null) &&
      <Alert severity="error" sx={{ mb: 1 }}>
        {`${error}: ${errorDescription}`}
      </Alert>
    }

    {getStatusesRequest.data != null && <>
      <div>
        The following shows the current status of each Twitch event subscription.
        Most of the communication with Twitch is established via these events.
        As such, ChatMate may not work correctly if any of the subscriptions are broken.
      </div>

      {requiresAuth && !isAuthSuccess && <>
        <Alert severity="warning">
          <div>
            Looks like some of the events are broken because ChatMate did not have permission.
            Please use your Twitch channel {<b>{primaryChannelsRequest.data?.twitchChannelName ?? '<loading>'}</b>} to provide access.
          </div>
          <Button
            onClick={onLoginToTwitch}
            disabled={getLoginUrlRequest.isLoading || getLoginUrlRequest.data == null || primaryChannelsRequest.isLoading || primaryChannelsRequest.data == null}
            sx={{ mt: 1 }}
          >
            Authorise ChatMate
          </Button>
          <ApiError requestObj={[getLoginUrlRequest, primaryChannelsRequest]} />
        </Alert>
      </>}

      {isAuthSuccess && <>
        <Alert severity="success">
          Successfully authenticated ChatMate. You may have to wait for a few seconds for your changes to take effect.
        </Alert>
      </>}

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Event Name</TableCell>
            <TableCell>Info</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Last Change</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {getStatusesRequest.data.statuses.map((status, i) => <StatusRow key={i} status={status} />)}
        </TableBody>
      </Table>
    </>}

    <RequireRank admin hideAdminOutline>
      <>
        <Button
          sx={{ mt: 2 }}
          onClick={reconnectChatClientRequest.triggerRequest}
          disabled={reconnectChatClientRequest.isLoading}
        >
          Reconnect Twitch chat client
        </Button>
        <ApiError requestObj={reconnectChatClientRequest} />
      </>
    </RequireRank>
  </>
}

type StatusProps = {
  status: PublicTwitchEventStatus
}

function StatusRow (props: StatusProps) {
  const type = props.status.eventType
  const status = props.status.status
  const errorMessage = props.status.errorMessage
  const lastChange = props.status.lastChange

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
      <TableCell><RelativeTime time={lastChange} /></TableCell>
    </TableRow>
  )
}

function requiresAuthentication (status: PublicTwitchEventStatus) {
  return status.errorMessage?.toLowerCase().includes('subscription missing proper authorization') // automatically returned from EventSub after failing to subscribe
    || status.errorMessage?.toLowerCase().includes('authorisation has been revoked.') // custom error set by the Server when the user has revoked access to the ChatMate Application
}
