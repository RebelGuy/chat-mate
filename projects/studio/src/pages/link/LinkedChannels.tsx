import { assertUnreachable } from '@rebel/shared/util/typescript'
import { removeLinkedChannel, setPrimaryChannel, unsetPrimaryChannel } from '@rebel/studio/utility/api'
import * as React from 'react'
import RequireRank from '@rebel/studio/components/RequireRank'
import { PublicChannel } from '@rebel/api-models/public/user/PublicChannel'
import { Button, Checkbox, FormControlLabel, Switch, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { Box } from '@mui/system'
import useRequest, { onConfirmRequest, RequestResult, SuccessfulResponseData } from '@rebel/studio/hooks/useRequest'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'
import { GetLinkedChannelsResponse } from '@rebel/api-models/schema/user'
import { GetPrimaryChannelsResponse } from '@rebel/api-models/schema/streamer'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import { getChannelUrlFromPublic } from '@rebel/shared/util/channel'
import { useContext, useEffect } from 'react'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import ErrorMessage from '@rebel/studio/components/styled/ErrorMessage'
import { Link } from 'react-router-dom'
import { PageManager } from '@rebel/studio/pages/navigation'
import { PublicStreamerSummary } from '@rebel/api-models/public/streamer/PublicStreamerSummary'

type Props = {
  channelsRequestObj: RequestResult<SuccessfulResponseData<GetLinkedChannelsResponse>>
  primaryChannelsRequestObj: RequestResult<SuccessfulResponseData<GetPrimaryChannelsResponse>> | null
  onChange: () => void
  onRefresh: () => void
}

export default function LinkedChannels (props: Props) {
  const loginContext = useContext(LoginContext)

  useEffect(() => {
    loginContext.refreshData('streamerList')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const header = (
    <PanelHeader>Linked Channels {<RefreshButton isLoading={props.channelsRequestObj.isLoading || props.primaryChannelsRequestObj?.isLoading} onRefresh={props.onRefresh} />}</PanelHeader>
  )

  if (props.channelsRequestObj.data?.channels.length === 0) {
    return <>
      {header}
      <div>
        No YouTube or Twitch channels are linked. Create a new link using the below input field.
      </div>
    </>
  }

  const primaryYoutubeChannel = props.primaryChannelsRequestObj?.data?.youtubeChannelId
  const primaryTwitchChannel = props.primaryChannelsRequestObj?.data?.twitchChannelId

  const isPrimaryChannel = (channel: PublicChannel) => (channel.platform === 'youtube' && channel.channelId === primaryYoutubeChannel) || (channel.platform === 'twitch' && channel.channelId === primaryTwitchChannel)
  const canAddPrimaryChannel = (channel: PublicChannel) => (channel.platform === 'youtube' && primaryYoutubeChannel == null) || (channel.platform === 'twitch' && primaryTwitchChannel == null)

  const streamerInfo = loginContext.allStreamers.find(streamer => streamer.username == loginContext.username)!
  const isLive = streamerInfo.currentTwitchLivestream?.status === 'live' || streamerInfo.currentYoutubeLivestream?.status === 'live'
  const activeYoutubeLivestream = streamerInfo.currentYoutubeLivestream?.status === 'not_started'

  return <>
    {header}
    <RequireRank anyOwner>
      <>
        <Box>
          Primary linked channels are the channels that you will stream on. You can select at most one primary channel on YouTube, and one on Twitch. Primary channels are highlighted in the below table.
        </Box>
        {isLive && (
          <ErrorMessage>You cannot update your primary channels while livestreaming.</ErrorMessage>
        )}
        {!isLive && activeYoutubeLivestream && (
          <ErrorMessage>You cannot update your primary channels while a Youtube livestream is active. Please deactivate it in your <Link to={PageManager.path}>Manager page</Link>.</ErrorMessage>
        )}
      </>
    </RequireRank>
    {props.channelsRequestObj.data != null &&
      <Table size="small" style={{ maxWidth: 800 }}>
        <TableHead>
          <TableRow>
            <TableCell>Channel</TableCell>
            <TableCell>Platform</TableCell>
            <RequireRank anyOwner><TableCell>Primary channel</TableCell></RequireRank>
            <RequireRank admin hideAdminOutline><TableCell>Admin actions</TableCell></RequireRank>
          </TableRow>
        </TableHead>
        <TableBody>
          {props.channelsRequestObj.data.channels.map((c, i) =>
            <TableRow key={i} style={{ background: isPrimaryChannel(c) ? 'aliceblue' : undefined }}>
              <TableCell><a href={getChannelUrlFromPublic(c)}>{c.displayName}</a></TableCell>
              <TableCell>{c.platform === 'youtube' ? 'YouTube' : c.platform === 'twitch' ? 'Twitch' : assertUnreachable(c.platform)}</TableCell>
              <RequireRank anyOwner>
                <TableCell>
                  <ChangePrimaryChannel
                    channel={c}
                    isLoading={props.channelsRequestObj.isLoading || props.primaryChannelsRequestObj?.isLoading}
                    isPrimaryChannel={isPrimaryChannel(c)}
                    canAddPrimary={canAddPrimaryChannel(c)}
                    disabled={isLive || activeYoutubeLivestream}
                    onChange={props.onChange}
                  />
                </TableCell>
              </RequireRank>
              <RequireRank admin hideAdminOutline>
                <TableCell>
                  <UnlinkUser
                    channel={c}
                    isLoading={props.channelsRequestObj.isLoading || props.primaryChannelsRequestObj?.isLoading}
                    onChange={props.onChange}
                  />
                </TableCell>
              </RequireRank>
            </TableRow>
          )}
        </TableBody>
      </Table>
    }

    <ApiLoading requestObj={[props.channelsRequestObj, props.primaryChannelsRequestObj]} initialOnly />
    <ApiError requestObj={[props.channelsRequestObj, props.primaryChannelsRequestObj]} />
  </>
}

type ChangePrimaryChannelProps = {
  channel: PublicChannel
  isPrimaryChannel: boolean
  canAddPrimary: boolean
  isLoading: boolean | undefined
  disabled: boolean
  onChange: () => void
}

function ChangePrimaryChannel (props: ChangePrimaryChannelProps) {
  const confirmAction = () => onConfirmRequest(`Are you sure you want to ${props.isPrimaryChannel ? 'unset' : 'set'} the current primary channel?`)

  const setPrimaryChannelRequest = useRequest(setPrimaryChannel(props.channel.platform, props.channel.channelId), {
    onDemand: true,
    onRequest: confirmAction,
    onSuccess: props.onChange
  })
  const unsetPrimaryChannelRequest = useRequest(unsetPrimaryChannel(props.channel.platform), {
    onDemand: true,
    onRequest: confirmAction,
    onSuccess: props.onChange
  })

  if (!props.isPrimaryChannel && !props.canAddPrimary) {
    return null
  }

  const activeRequest = props.isPrimaryChannel ? unsetPrimaryChannelRequest : setPrimaryChannelRequest

  return (
    <>
      {(
        <Switch
          checked={props.isPrimaryChannel}
          disabled={activeRequest.isLoading || props.isLoading || props.disabled}
          onChange={activeRequest.triggerRequest}
        />
      )}
      <ApiLoading requestObj={activeRequest} />
      <ApiError requestObj={activeRequest} />
    </>
  )
}

function UnlinkUser (props: { channel: PublicChannel, isLoading: boolean | undefined, onChange: () => void }) {
  const [transferRanks, setTransferRanks] = React.useState(true)
  const [relinkChatExperience, setRelinkChatExperience] = React.useState(true)
  const [relinkDoantions, setRelinkDonations] = React.useState(true)
  const request = useRequest(removeLinkedChannel(props.channel.defaultUserId, transferRanks, relinkChatExperience, relinkDoantions), {
    onDemand: true,
    onRequest: () => onConfirmRequest('Are you sure you wish to unlink the user?'),
    onSuccess: props.onChange
  })

  return <>
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <FormControlLabel
        label="Transfer ranks"
        control={
          <Checkbox
            checked={transferRanks}
            onChange={() => setTransferRanks(!transferRanks)}
            sx={{ pt: 0, pb: 0, ml: 2 }}
          />
        }
      />
      <FormControlLabel
        label="Relink chat experience"
        control={
          <Checkbox
            checked={relinkChatExperience}
            onChange={() => setRelinkChatExperience(!relinkChatExperience)}
            sx={{ pt: 0, pb: 0, ml: 2 }}
          />
        }
      />
      <FormControlLabel
        label="Relink donations"
        control={
          <Checkbox
            checked={relinkDoantions}
            onChange={() => setRelinkDonations(!relinkDoantions)}
            sx={{ pt: 0, pb: 0, ml: 2 }}
          />
        }
      />
      <Button
        disabled={request.isLoading || props.isLoading}
        sx={{ m: 2 }}
        onClick={request.triggerRequest}
      >
        Remove link
      </Button>
      <Box>
        {request.data != null && <div>Success!</div>}
        <ApiLoading requestObj={request} />
        <ApiError requestObj={request} />
      </Box>
    </Box>
  </>
}
