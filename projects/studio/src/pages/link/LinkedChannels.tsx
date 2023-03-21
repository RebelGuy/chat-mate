import { assertUnreachable } from '@rebel/shared/util/typescript'
import { removeLinkedChannel, setPrimaryChannel, unsetPrimaryChannel } from '@rebel/studio/utility/api'
import * as React from 'react'
import ApiRequestTrigger from '@rebel/studio/components/ApiRequestTrigger'
import RequireRank from '@rebel/studio/components/RequireRank'
import { sortBy } from '@rebel/shared/util/arrays'
import { PublicChannel } from '@rebel/server/controllers/public/user/PublicChannel'
import { Button, Checkbox, FormControlLabel, IconButton, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { Box } from '@mui/system'
import { Refresh } from '@mui/icons-material'
import { getChannelUrl } from '@rebel/studio/utility/misc'

export default function LinkedChannels (props: { channels: PublicChannel[], primaryChannels: { youtubeChannelId: number | null, twitchChannelId: number | null }, onChange: () => void, onRefresh: () => void }) {
  const header = (
    <h3>Linked Channels {<IconButton onClick={props.onRefresh}><Refresh /></IconButton>}</h3>
  )

  if (props.channels.length === 0) {
    return <>
      {header}
      <div>
        No YouTube or Twitch channels are linked. Create a new link using the below input field.
      </div>
    </>
  }

  const isPrimaryChannel = (channel: PublicChannel) => (channel.platform === 'youtube' && channel.channelId === props.primaryChannels.youtubeChannelId) || (channel.platform === 'twitch' && channel.channelId === props.primaryChannels.twitchChannelId)
  const canAddPrimaryChannel = (channel: PublicChannel) => (channel.platform === 'youtube' && props.primaryChannels.youtubeChannelId == null) || (channel.platform === 'twitch' && props.primaryChannels.twitchChannelId == null)

  return <>
    {header}
    <RequireRank owner>
      <Box>
        Primary linked channels are the channels that you will stream on. You can select at most one primary channel on YouTube, and one on Twitch.
      </Box>
    </RequireRank>
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
        {sortBy(props.channels, c => isPrimaryChannel(c) ? c.channelId * -1 : c.channelId).map((c, i) =>
          <TableRow key={i} style={{ background: isPrimaryChannel(c) ? 'aliceblue' : undefined }}>
            <TableCell><a href={getChannelUrl(c)}>{c.displayName}</a></TableCell>
            <TableCell>{c.platform === 'youtube' ? 'YouTube' : c.platform === 'twitch' ? 'Twitch' : assertUnreachable(c.platform)}</TableCell>
            <RequireRank anyOwner>
              <TableCell>
                <ChangePrimaryChannel channel={c} isPrimaryChannel={isPrimaryChannel(c)} canAddPrimary={canAddPrimaryChannel(c)} onChange={props.onChange} />
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
  </>
}

function ChangePrimaryChannel (props: { channel: PublicChannel, isPrimaryChannel: boolean, canAddPrimary: boolean, onChange: () => void }) {
  if (!props.isPrimaryChannel && !props.canAddPrimary) {
    return null
  }

  const onChangePrimaryChannel = async (loginToken: string) => {
    if (!window.confirm(`Are you sure you want to ${props.isPrimaryChannel ? 'unset' : 'set'} the current primary channel?`)) {
      throw new Error('Aborted')
    }

    const result = props.isPrimaryChannel ? await unsetPrimaryChannel(loginToken, props.channel.platform) : await setPrimaryChannel(loginToken, props.channel.platform, props.channel.channelId)

    if (result.success) {
      props.onChange()
    }

    return result
  }

  const platform = props.channel.platform === 'youtube' ? 'YouTube' : 'Twitch'

  return <>
    <ApiRequestTrigger onRequest={onChangePrimaryChannel}>
      {(onMakeRequest, response, loading, error) => <>
        <Button
          style={{ color: props.isPrimaryChannel ? 'red' : undefined }}
          disabled={loading != null}
          onClick={onMakeRequest}
        >
          {props.isPrimaryChannel ? `Unset primary channel for ${platform}` : `Set primary channel for ${platform}`}
        </Button>
        {error != null && (
          <Box sx={{ mt: 1 }}>
            {error}
          </Box>
        )}
      </>}
    </ApiRequestTrigger>
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
