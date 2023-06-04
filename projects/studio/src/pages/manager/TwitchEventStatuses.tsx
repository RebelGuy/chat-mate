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
import { authoriseTwitchStreamer, getPrimaryChannels, getTwitchEventStatuses, getTwitchStreamerLoginUrl, reconnectChatClient, resetTwitchSubscriptions } from '@rebel/studio/utility/api'
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
  const code = params.get('code')

  const [refreshToken, updateRefreshToken] = useUpdateKey()
  const getStatusesRequest = useRequest(getTwitchEventStatuses(), { updateKey: refreshToken })
  const reconnectChatClientRequest = useRequest(reconnectChatClient(), { onDemand: true })
  const resetTwitchSubscriptionsRequest = useRequest(resetTwitchSubscriptions(), { onDemand: true })
  const primaryChannelsRequest = useRequest(getPrimaryChannels(), { onDemand: true })
  const getLoginUrlRequest = useRequest(getTwitchStreamerLoginUrl(), { onDemand: true })
  const authoriseTwitchRequest = useRequest(authoriseTwitchStreamer(code!), { onDemand: true })

  const [error] = useState<string | null>(params.get('error'))
  const [errorDescription] = useState<string | null>(params.get('error_description'))

  // if true, we detected that ChatMate is not working properly because of missing permissions
  const requiresAuth = getStatusesRequest.data == null || getStatusesRequest.data.statuses.find(status => status.requiresAuthorisation) != null
  const hasBrokenEvents = getStatusesRequest.data?.statuses.find(status => status.status === 'inactive') != null

  useEffect(() => {
    // for some reason we can't immediately clear the params here, else the states won't initialise. but it's working fine on the admin authentication page?!
    const timeout = window.setTimeout(() => setParams({}), 500)

    primaryChannelsRequest.triggerRequest()
    getLoginUrlRequest.triggerRequest()
    if (code != null) {
      authoriseTwitchRequest.triggerRequest()
    }

    return () => window.clearTimeout(timeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // if the user authorised successfully, it may take a few seconds for events to re-subscribe. poll the server until we are in the clear
  useEffect(() => {
    if (authoriseTwitchRequest.data != null && requiresAuth) {
      // what the fuck is eslint on about
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      successPoller = window.setInterval(updateRefreshToken, 2000)

      // if we take longer than this then something probably went wrong and we don't want to keep polling
      window.setTimeout(() => {
        window.clearTimeout(successPoller!)
        authoriseTwitchRequest.reset()
      }, 10000)
    } else if (authoriseTwitchRequest.data != null && !requiresAuth) {
      setParams({})
      window.clearTimeout(successPoller!)
      authoriseTwitchRequest.reset()
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authoriseTwitchRequest.data, requiresAuth])

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

      {authoriseTwitchRequest.data == null && <>
        <Alert sx={{ mt: 1 }} severity={requiresAuth || hasBrokenEvents ? 'warning' : 'info'}>
          {requiresAuth ?
            <div>
              Looks like some of the events are broken because ChatMate did not have permission.
              Please use your Twitch channel {<b>{primaryChannelsRequest.data?.twitchChannelName ?? '<loading>'}</b>} to provide access.
            </div>
            :
            hasBrokenEvents ?
              <div>
                Looks like one or more events are broken. Please contact an administrator.
                You can also try refreshing authorisation for the channel {<b>{primaryChannelsRequest.data?.twitchChannelName ?? '<loading>'}</b>} using the below button.
              </div>
              :
              <div>
                Looks like all events are working correctly and you do not need to authorise ChatMate again.
                If you still want to refresh authorisation for the channel {<b>{primaryChannelsRequest.data?.twitchChannelName ?? '<loading>'}</b>}, you can do so using the below button.
              </div>
          }
          <Button
            onClick={onLoginToTwitch}
            disabled={getLoginUrlRequest.isLoading || getLoginUrlRequest.data == null || primaryChannelsRequest.isLoading || primaryChannelsRequest.data == null || authoriseTwitchRequest.isLoading}
            sx={{ mt: 1 }}
          >
            Authorise ChatMate
          </Button>
        </Alert>
      </>}

      <ApiError requestObj={[getLoginUrlRequest, primaryChannelsRequest, authoriseTwitchRequest]} hideRetryButton />

      {authoriseTwitchRequest.data != null && <>
        <Alert sx={{ mt: 1 }} severity="success">
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

    <RequireRank admin adminSx={{ mt: 2, width: 'fit-content' }}>
      <>
        <Button
          onClick={reconnectChatClientRequest.triggerRequest}
          disabled={reconnectChatClientRequest.isLoading}
        >
          Reconnect Twitch chat client
        </Button>
        <ApiError requestObj={reconnectChatClientRequest} />

        <Button
          onClick={resetTwitchSubscriptionsRequest.triggerRequest}
          disabled={resetTwitchSubscriptionsRequest.isLoading}
          sx={{ ml: 2 }}
        >
          Reset all Twitch event subscriptions
        </Button>
        <ApiError requestObj={resetTwitchSubscriptionsRequest} />
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
  if (status === 'active' && errorMessage == null) {
    statusIcon = <Done color="success" />
    tooltip = 'Subscription is active.'
  } else if (status === 'pending' && errorMessage == null) {
    statusIcon = <CircularProgress size="1rem" />
    tooltip = 'Subscription is being created - please wait a few seconds.'
  } else if (errorMessage == null) {
    statusIcon = <Close color="warning" />
    tooltip = 'Subscription is not active.'
  } else {
    statusIcon = <Error color={status === 'active' ? 'warning' : 'error'} />
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
      <TableCell><RelativeTime time={lastChange} useSentenceCase /></TableCell>
    </TableRow>
  )
}
