import { assertUnreachable } from '@rebel/shared/util/typescript'
import { removeLinkedChannel, setPrimaryChannel, unsetPrimaryChannel } from '@rebel/studio/utility/api'
import * as React from 'react'
import ApiRequestTrigger from '@rebel/studio/components/ApiRequestTrigger'
import RequireRank from '@rebel/studio/components/RequireRank'
import { sortBy } from '@rebel/shared/util/arrays'
import { PublicChannel } from '@rebel/server/controllers/public/user/PublicChannel'
import { Button, Checkbox, FormControlLabel, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { Box } from '@mui/system'
import { getChannelUrl } from '@rebel/studio/utility/misc'
import useRequest, { RequestResult, SuccessfulResponseData } from '@rebel/studio/hooks/useRequest'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'
import { GetLinkedChannelsResponse } from '@rebel/server/controllers/UserController'
import { GetPrimaryChannelsResponse } from '@rebel/server/controllers/StreamerController'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'

type Props = {
  channelsRequestObj: RequestResult<SuccessfulResponseData<GetLinkedChannelsResponse>>
  primaryChannelsRequestObj: RequestResult<SuccessfulResponseData<GetPrimaryChannelsResponse>>
  onChange: () => void
  onRefresh: () => void
}

export default function LinkedChannels (props: Props) {
  const header = (
    <PanelHeader>Linked Channels {<RefreshButton isLoading={props.channelsRequestObj.isLoading || props.primaryChannelsRequestObj.isLoading} onRefresh={props.onRefresh} />}</PanelHeader>
  )

  if (props.channelsRequestObj.data?.channels.length === 0) {
    return <>
      {header}
      <div>
        No YouTube or Twitch channels are linked. Create a new link using the below input field.
      </div>
    </>
  }

  const primaryYoutubeChannel = props.primaryChannelsRequestObj.data?.youtubeChannelId
  const primaryTwitchChannel = props.primaryChannelsRequestObj.data?.twitchChannelId

  const isPrimaryChannel = (channel: PublicChannel) => (channel.platform === 'youtube' && channel.channelId === primaryYoutubeChannel) || (channel.platform === 'twitch' && channel.channelId === primaryTwitchChannel)
  const canAddPrimaryChannel = (channel: PublicChannel) => (channel.platform === 'youtube' && primaryYoutubeChannel == null) || (channel.platform === 'twitch' && primaryTwitchChannel == null)

  return <>
    {header}
    <RequireRank owner>
      <Box>
        Primary linked channels are the channels that you will stream on. You can select at most one primary channel on YouTube, and one on Twitch.
      </Box>
    </RequireRank>
    {props.channelsRequestObj.data != null &&
      <Table style={{ margin: 'auto' }}>
        <TableHead>
          <TableRow>
            <TableCell>Channel</TableCell>
            <TableCell>Platform</TableCell>
            <RequireRank anyOwner><TableCell>Streamer actions</TableCell></RequireRank>
            <RequireRank admin hideAdminOutline><TableCell>Admin actions</TableCell></RequireRank>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortBy(props.channelsRequestObj.data.channels, c => isPrimaryChannel(c) ? c.channelId * -1 : c.channelId).map((c, i) =>
            <TableRow key={i} style={{ background: isPrimaryChannel(c) ? 'aliceblue' : undefined }}>
              <TableCell><a href={getChannelUrl(c)}>{c.displayName}</a></TableCell>
              <TableCell>{c.platform === 'youtube' ? 'YouTube' : c.platform === 'twitch' ? 'Twitch' : assertUnreachable(c.platform)}</TableCell>
              <RequireRank anyOwner>
                <TableCell>
                  <ChangePrimaryChannel
                    channel={c}
                    isLoading={props.channelsRequestObj.isLoading || props.primaryChannelsRequestObj.isLoading}
                    isPrimaryChannel={isPrimaryChannel(c)}
                    canAddPrimary={canAddPrimaryChannel(c)}
                    onChange={props.onChange}
                  />
                </TableCell>
              </RequireRank>
              <RequireRank admin hideAdminOutline>
                <TableCell>
                  <UnlinkUser channel={c} onChange={props.onChange} />
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
  isLoading: boolean
  onChange: () => void
}

function ChangePrimaryChannel (props: ChangePrimaryChannelProps) {
  const confirmAction = () => {
    if (!window.confirm(`Are you sure you want to ${props.isPrimaryChannel ? 'unset' : 'set'} the current primary channel?`)) {
      throw new Error('Aborted')
    }
  }

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
  const platform = props.channel.platform === 'youtube' ? 'YouTube' : 'Twitch'

  return <>
    <Button
      style={{ color: props.isPrimaryChannel ? 'red' : undefined }}
      disabled={activeRequest.isLoading || props.isLoading}
      onClick={activeRequest.triggerRequest}
    >
      {props.isPrimaryChannel ? `Unset primary channel for ${platform}` : `Set primary channel for ${platform}`}
    </Button>
    <ApiLoading requestObj={activeRequest} />
    <ApiError requestObj={activeRequest} />
  </>
}

function UnlinkUser (props: { channel: PublicChannel, onChange: () => void }) {
  const [transferRanks, setTransferRanks] = React.useState(true)
  const [relinkChatExperience, setRelinkChatExperience] = React.useState(true)
  const [relinkDoantions, setRelinkDonations] = React.useState(true)

  const removeLink = async (loginToken: string) => {
    if (!window.confirm('Are you sure you wish to unlink the user?')) {
      throw new Error('Aborted')
    }

    const result = await removeLinkedChannel(loginToken, props.channel.defaultUserId, transferRanks, relinkChatExperience, relinkDoantions)

    if (result.success) {
      props.onChange()
    }

    return result
  }

  return <>
    <ApiRequestTrigger onRequest={removeLink}>
      {(onMakeRequest, response, loading, error) => (
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
            disabled={loading != null}
            sx={{ m: 2 }}
            onClick={onMakeRequest}
          >
            Remove link
          </Button>
          <Box>
            {response != null && <div>Success!</div>}
            {error}
          </Box>
        </Box>
      )}
    </ApiRequestTrigger>
  </>
}
