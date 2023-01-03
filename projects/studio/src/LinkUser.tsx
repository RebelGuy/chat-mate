import { PublicLinkToken } from '@rebel/server/controllers/public/user/PublicLinkToken'
import { GetLinkTokensResponse } from '@rebel/server/controllers/UserController'
import { sortBy } from '@rebel/server/util/arrays'
import { assertUnreachable } from '@rebel/server/util/typescript'
import { createLinkToken, getLinkTokens } from '@rebel/studio/api'
import ApiRequest from '@rebel/studio/ApiRequest'
import ApiRequestTrigger from '@rebel/studio/ApiRequestTrigger'
import * as React from 'react'

export default function LinkUser () {
  const [updateToken, setUpdateToken] = React.useState(new Date().getTime())

  const regenerateUpdateToken = () => setUpdateToken(new Date().getTime())

  return (
    <ApiRequest onDemand={true} token={updateToken} onRequest={getLinkTokens}>
      {(response, loadingNode, errorNode) => <>
        <button style={{ display: 'block', margin: 'auto', marginBottom: 32 }} disabled={loadingNode != null} onClick={regenerateUpdateToken}>Refresh</button>
        {response && <>
          <LinkHistory data={response} />
          <CreateLinkToken onCreated={regenerateUpdateToken} />
        </>}
        {loadingNode}
        {errorNode}
      </>}
    </ApiRequest>
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
