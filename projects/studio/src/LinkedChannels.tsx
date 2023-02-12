import { assertUnreachable } from '@rebel/shared/util/typescript'
import { removeLinkedChannel, setPrimaryChannel, unsetPrimaryChannel } from '@rebel/studio/api'
import * as React from 'react'
import ApiRequestTrigger from '@rebel/studio/ApiRequestTrigger'
import RequireRank from '@rebel/studio/components/RequireRank'
import { sortBy } from '@rebel/shared/util/arrays'
import { PublicChannel } from '@rebel/server/controllers/public/user/PublicChannel'

export default function LinkedChannels (props: { channels: PublicChannel[], primaryChannels: { youtubeChannelId: number | null, twitchChannelId: number | null }, onChange: () => void }) {
  if (props.channels.length === 0) {
    return <>
      <h3>Linked Channels</h3>
      <div>
        No YouTube or Twitch channels are linked. Create a new link using the below input field.
      </div>
    </>
  }

  const isPrimaryChannel = (channel: PublicChannel) => (channel.platform === 'youtube' && channel.channelId === props.primaryChannels.youtubeChannelId) || (channel.platform === 'twitch' && channel.channelId === props.primaryChannels.twitchChannelId)
  const canAddPrimaryChannel = (channel: PublicChannel) => (channel.platform === 'youtube' && props.primaryChannels.youtubeChannelId == null) || (channel.platform === 'twitch' && props.primaryChannels.twitchChannelId == null)
  
  return <>
    <h3>Linked Channels</h3>
    <table style={{ margin: 'auto' }}>
      <tr>
        <th>Channel name</th>
        <th>Platform</th>
        <RequireRank anyOwner><th>Streamer actions</th></RequireRank>
        <RequireRank admin><th>Admin actions</th></RequireRank>
      </tr>
      {sortBy(props.channels, c => isPrimaryChannel(c) ? c.channelId * -1 : c.channelId).map(c => <tr style={{ background: isPrimaryChannel(c) ? 'aliceblue' : undefined }}>
        <td><a href={getChannelUrl(c)}>{c.displayName}</a></td>
        <td>{c.platform === 'youtube' ? 'YouTube' : c.platform === 'twitch' ? 'Twitch' : assertUnreachable(c.platform)}</td>
        <RequireRank anyOwner>
          <td>
            <ChangePrimaryChannel channel={c} isPrimaryChannel={isPrimaryChannel(c)} canAddPrimary={canAddPrimaryChannel(c)} onChange={props.onChange} />
          </td>
        </RequireRank>
        <RequireRank admin>
          <td>
            <UnlinkUser channel={c} onChange={props.onChange} />
          </td>
        </RequireRank>
      </tr>)}
    </table>
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
        <button style={{ color: props.isPrimaryChannel ? 'red' : undefined }} disabled={loading != null} onClick={onMakeRequest}>{props.isPrimaryChannel ? `Unset primary channel for ${platform}` : `Set primary channel for ${platform}`}</button>
        {error}
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
    <div style={{ background: 'rgba(255, 0, 0, 0.2)' }}>
      <ApiRequestTrigger onRequest={removeLink}>
        {(onMakeRequest, response, loading, error) => <>
          <div style={{ display: 'flex' }}>
            <input type="checkbox" name="Transfer ranks" checked={transferRanks} onChange={() => setTransferRanks(!transferRanks)} />
            <label>Transfer ranks</label>
          </div>
          <div style={{ display: 'flex' }}>
            <input type="checkbox" name="Relink chat experience" checked={relinkChatExperience} onChange={() => setRelinkChatExperience(!relinkChatExperience)} />
            <label>Relink chat experience</label>
          </div>
          <div style={{ display: 'flex' }}>
            <input type="checkbox" name="Relink donations" checked={relinkDoantions} onChange={() => setRelinkDonations(!relinkDoantions)} />
            <label>Relink donations</label>
          </div>
          <button disabled={loading != null} onClick={onMakeRequest}>Remove link</button>
          {response != null && <div>Success!</div>}
          {error}
        </>}
      </ApiRequestTrigger>
    </div>
  </>
}

function getChannelUrl (channel: PublicChannel) {
  if (channel.platform === 'youtube') {
    return `https://www.youtube.com/channel/${channel.externalIdOrUserName}`
  } else if (channel.platform === 'twitch') {
    return `https://www.twitch.tv/${channel.externalIdOrUserName}`
  } else {
    assertUnreachable(channel.platform)
  }
}
