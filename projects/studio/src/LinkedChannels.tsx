import { PublicChannelInfo } from '@rebel/server/controllers/public/user/PublicChannelInfo'
import { assertUnreachable } from '@rebel/server/util/typescript'
import { removeLinkedChannel } from '@rebel/studio/api'
import * as React from 'react'
import ApiRequestTrigger from '@rebel/studio/ApiRequestTrigger'

export default function LinkedChannels (props: { channels: PublicChannelInfo[], isAdmin: boolean, onChange: () => void }) {
  if (props.channels.length === 0) {
    return <>
      <h3>Linked Channels</h3>
      <div>
        No YouTube or Twitch channels are linked. Create a new link using the below input field.
      </div>
    </>
  }

  return <>
    <h3>Linked Channels</h3>
    <table style={{ margin: 'auto' }}>
      <tr>
        <th>Channel name</th>
        <th>Platform</th>
        {props.isAdmin && <th>Admin actions</th>}
      </tr>
      {props.channels.map(c => <tr>
        <td><a href={getChannelUrl(c)}>{c.channelName}</a></td>
        <td>{c.platform === 'youtube' ? 'YouTube' : c.platform === 'twitch' ? 'Twitch' : assertUnreachable(c.platform)}</td>
        {props.isAdmin && <UnlinkUser channel={c} onChange={props.onChange} />}
      </tr>)}
    </table>
  </>
}

function UnlinkUser (props: { channel: PublicChannelInfo, onChange: () => void }) {
  const [transferRanks, setTransferRanks] = React.useState(true)
  const [relinkChatExperience, setRelinkChatExperience] = React.useState(true)
  const [relinkDoantions, setRelinkDonations] = React.useState(true)

  const removeLink = async (loginToken: string) => {
    const result = await removeLinkedChannel(loginToken, props.channel.defaultUserId, transferRanks, relinkChatExperience, relinkDoantions)

    if (result.success) {
      props.onChange()
    }

    return result
  }

  return <div style={{ background: 'rgba(255, 0, 0, 0.2)' }}>
    <ApiRequestTrigger onRequest={removeLink}>
      {(onMakeRequest, response, loading, error) => <>
        <td>
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
        </td>
      </>}
    </ApiRequestTrigger>
  </div>
}

function getChannelUrl (channel: PublicChannelInfo) {
  if (channel.platform === 'youtube') {
    return `https://www.youtube.com/channel/${channel.externalIdOrUserName}`
  } else if (channel.platform === 'twitch') {
    return `https://www.twitch.tv/${channel.externalIdOrUserName}`
  } else {
    assertUnreachable(channel.platform)
  }
}
