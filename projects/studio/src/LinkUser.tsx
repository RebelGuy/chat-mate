import { PublicUserRank } from '@rebel/server/controllers/public/rank/PublicUserRank'
import { PublicChannelInfo } from '@rebel/server/controllers/public/user/PublicChannelInfo'
import { PublicLinkToken } from '@rebel/server/controllers/public/user/PublicLinkToken'
import { GetLinkTokensResponse } from '@rebel/server/controllers/UserController'
import { sortBy } from '@rebel/server/util/arrays'
import { assertUnreachable } from '@rebel/server/util/typescript'
import { createLinkToken, getGlobalRanks, getLinkedChannels, getLinkTokens, removeLinkedChannel } from '@rebel/studio/api'
import ApiRequest from '@rebel/studio/ApiRequest'
import ApiRequestTrigger from '@rebel/studio/ApiRequestTrigger'
import * as React from 'react'

export default function LinkUser () {
  const [updateToken, setUpdateToken] = React.useState(Date.now())
  const [userRanks, setUserRanks] = React.useState<PublicUserRank[]>([])

  const regenerateUpdateToken = () => setUpdateToken(Date.now())
  const getRanks = async (loginToken: string) => {
    const response = await getGlobalRanks(loginToken)

    if (response.success) {
      setUserRanks(response.data.ranks)
    }

    return response
  }

  const isAdmin = userRanks.find(r => r.rank.name === 'admin') != null

  return (
    <div>
      <ApiRequest onDemand token={updateToken} onRequest={getRanks} />
      <button style={{ display: 'block', margin: 'auto', marginBottom: 32 }} onClick={regenerateUpdateToken}>Refresh</button>
      <div style={{ marginBottom: 16 }}>
        <ApiRequest onDemand token={updateToken} onRequest={getLinkedChannels}>
          {(response, loadingNode, errorNode) => <>
            {response && <LinkedChannels channels={response.channels} isAdmin={isAdmin} onChange={regenerateUpdateToken} />}
            {loadingNode}
            {errorNode}
          </>}
        </ApiRequest>
      </div>
      <ApiRequest onDemand token={updateToken} onRequest={getLinkTokens}>
        {(response, loadingNode, errorNode) => <>
          {response && <>
            <LinkHistory data={response} />
            <CreateLinkToken onCreated={regenerateUpdateToken} />
          </>}
          {loadingNode}
          {errorNode}
        </>}
      </ApiRequest>
    </div>
  )
}

function LinkedChannels (props: { channels: PublicChannelInfo[], isAdmin: boolean, onChange: () => void }) {
  
  if (props.channels.length === 0) {
    return <div>
      No YouTube or Twitch channels are linked. Create a new link using the below input field.
    </div>
  }

  return <table style={{ margin: 'auto' }}>
    <tr>
      <th>Channel name</th>
      <th>Platform</th>
      {props.isAdmin && <th></th>}
    </tr>
    {props.channels.map(c => <tr>
      <td><a href={getChannelUrl(c)}>{c.channelName}</a></td>
      <td>{c.platform === 'youtube' ? 'YouTube' : c.platform === 'twitch' ? 'Twitch' : assertUnreachable(c.platform)}</td>
      {props.isAdmin && <UnlinkUser channel={c} onChange={props.onChange} />}
    </tr>)}
  </table>
}

function UnlinkUser (props: { channel: PublicChannelInfo, onChange: () => void }) {
  const [transferRanks, setTransferRanks] = React.useState(true)
  const [relinkChatExperience, setRelinkChatExperience] = React.useState(true)

  const removeLink = async (loginToken: string) => {
    const result = await removeLinkedChannel(loginToken, props.channel.defaultUserId, transferRanks, relinkChatExperience)

    if (result.success) {
      props.onChange()
    }

    return result
  }

  return (
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
          <button disabled={loading != null} onClick={onMakeRequest}>Remove link</button>
        </td>
      </>}
    </ApiRequestTrigger>
  )
}

function LinkHistory (props: { data: Extract<GetLinkTokensResponse, { success: true }>['data'] }) {
  if (props.data.tokens.length === 0) {
    return <div>
      No existing link attempts to show. Create a new link using the below input field.
    </div>
  }

  const tokens = sortBy(props.data.tokens, t => t.status === 'processing' ? 0 : t.status === 'waiting' ? 1 : 2)

  return <table style={{ margin: 'auto' }}>
    <tr>
      <th>Channel name</th>
      <th>Platform</th>
      <th>Link status</th>
      <th>Link token</th>
      <th>Message</th>
    </tr>
    {tokens.map(t => <tr>
      <td>{t.channelUserName}</td>
      <td>{t.platform === 'youtube' ? 'YouTube' : t.platform === 'twitch' ? 'Twitch' : assertUnreachable(t.platform)}</td>
      <td>{t.status}</td>
      <td>{t.token}</td>
      <td><TokenMessage token={t} /></td>
    </tr>)}
  </table>
}

// todo: should also be searchable by username
function CreateLinkToken (props: { onCreated: () => void }) {
  const [channelInput, setChannelInput] = React.useState('')
  const { channelId, error: validationError } = validateChannel(channelInput)
  const showError = channelInput.length > 0 && validationError != null
  
  const onCreateLinkToken = async (loginToken: string) => {
    if (channelId == null) {
      throw new Error('Channel ID is null')
    }
    const result = await createLinkToken(loginToken, channelId)

    if (result.success) {
      props.onCreated()
    }

    return result
  }

  return <div style={{ marginTop: 24 }}>
    <div>You can link a channel to your account to manage your profile and access other exclusive features.</div>
    <div>If linking multiple channels, all data (experience, ranks, etc.) will be merged as if you were using a single account all along. This cannot be undone.</div>
    <ApiRequestTrigger onRequest={onCreateLinkToken}>
      {(onMakeRequest, response, loadingNode, errorNode) =>
        <>
          <input type="text" disabled={loadingNode != null} placeholder="Enter channel URL or ID" value={channelInput} onChange={e => setChannelInput(e.target.value)} />
          {showError && <div color="red">{validationError}</div>}
          {loadingNode}
          {errorNode}
          <button type="button" disabled={loadingNode != null || showError} onClick={onMakeRequest}>Submit</button>
        </>
      }
    </ApiRequestTrigger>
  </div>
}

function validateChannel (channel: string): { channelId: string | null, error: string | null } {
  if (channel.includes('/channel/')) {
    channel = channel.substring(channel.indexOf('/channel/') + '/channel/'.length)
  } else if (channel.includes('twitch.tv/')) {
    channel = channel.substring(channel.indexOf('twitch.tv/') + 'twitch.tv/'.length)
  }

  if (channel.startsWith('UC')) {
    if (channel.length === 24) {
      return { channelId: channel, error: null }
    } else {
      return { channelId: null, error: 'Invalid YouTube channel ID - expected 24 characters' }
    }
  }

  if (channel.includes('!@#$%^&*(){}|;:\'"`~?/>.<,=+[]\\')) {
    return { channelId: null, error: 'Invalid channel ID - includes special characters' }
  }

  return { channelId: channel, error: null }
}

let timeout: number | null = null
function TokenMessage (props: { token: PublicLinkToken }) {
  const [showCopied, setShowCopied] = React.useState(false)

  const command = `!link ${props.token.token}`
  const onCopy = () => {
    navigator.clipboard.writeText(command)
    setShowCopied(true)
    if (timeout != null) {
      clearTimeout(timeout)
    }
    timeout = window.setTimeout(() => setShowCopied(false), 2000)
  }

  if (props.token.message != null) {
    return <div>{props.token.message}</div>
  } else if (props.token.status === 'pending' || props.token.status === 'processing') {
    return <div>Please wait for the link to complete</div>
  } else if (props.token.status === 'waiting') {
    return <>
      <div style={{ display: 'block' }}>
        <div>To initiate the link, type the following command: </div><code>{command}</code>
      </div>
      <button onClick={onCopy}>Copy command</button>
      {showCopied && <div>Copied!</div>}
    </>
  } else {
    return <div>n/a</div>
  }
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
