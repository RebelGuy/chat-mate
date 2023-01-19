import { GetLinkTokensResponse } from '@rebel/server/controllers/UserController'
import { assertUnreachable } from '@rebel/server/util/typescript'
import { sortBy } from '@rebel/server/util/arrays'
import { PublicLinkToken } from '@rebel/server/controllers/public/user/PublicLinkToken'
import * as React from 'react'

export function LinkHistory (props: { data: Extract<GetLinkTokensResponse, { success: true }>['data'] }) {
  if (props.data.tokens.length === 0) {
    return <>
      <h3>Link History</h3>
      <div>
        No existing link attempts to show. Create a new link using the below input field.
      </div>
    </>
  }

  const tokens = sortBy(props.data.tokens, t => t.status === 'processing' ? 0 : t.status === 'waiting' ? 1 : 2)

  return <>
    <h3>Link History</h3>
    <table style={{ margin: 'auto' }}>
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
  </>
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
