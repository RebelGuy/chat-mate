import { GetLinkHistoryResponse } from '@rebel/server/controllers/UserController'
import { assertUnreachable } from '@rebel/server/util/typescript'
import { sortBy } from '@rebel/server/util/arrays'
import * as React from 'react'
import { PublicLinkHistoryItem } from '@rebel/server/controllers/public/user/PublicLinkHistoryItem'
import { capitaliseWord } from '@rebel/server/util/text'

export function LinkHistory (props: { data: Extract<GetLinkHistoryResponse, { success: true }>['data'] }) {
  if (props.data.items.length === 0) {
    return <>
      <h3>Link History</h3>
      <div>
        No existing link attempts to show. Create a new link using the below input field.
      </div>
    </>
  }

  // show unfinished links first, then order completed links in descending order. kinda nasty but it works!
  const maxDate = Math.max(...props.data.items.filter(item => item.dateCompleted != null).map(item => item.dateCompleted!))
  const tokens = sortBy(props.data.items, t => t.status === 'processing' || t.status === 'pending' ? 1 : t.status === 'waiting' ? 0 : maxDate + 1 - t.dateCompleted!)

  return <>
    <h3>Link History</h3>
    <table style={{ margin: 'auto' }}>
      <tr>
        <th>Channel name</th>
        <th>Platform</th>
        <th>Type</th>
        <th>Link status</th>
        <th>Link token</th>
        <th>Message</th>
        <th>Date</th>
      </tr>
      {tokens.map(item => <tr>
        <td>{item.channelUserName}</td>
        <td>{item.platform === 'youtube' ? 'YouTube' : item.platform === 'twitch' ? 'Twitch' : assertUnreachable(item.platform)}</td>
        <td>{capitaliseWord(item.type)}</td>
        <td>{item.status}</td>
        <td>{item.token ?? 'Initiated by admin'}</td>
        <td><ItemMessage item={item} /></td>
        <td>{item.dateCompleted == null ? '' : new Date(item.dateCompleted).toLocaleString()}</td>
      </tr>)}
    </table>
  </>
}

let timeout: number | null = null
function ItemMessage (props: { item: PublicLinkHistoryItem }) {
  const [showCopied, setShowCopied] = React.useState(false)

  const command = `!link ${props.item.token}`
  const onCopy = () => {
    navigator.clipboard.writeText(command)
    setShowCopied(true)
    if (timeout != null) {
      clearTimeout(timeout)
    }
    timeout = window.setTimeout(() => setShowCopied(false), 2000)
  }

  if (props.item.message != null) {
    return <div>{props.item.message}</div>
  } else if (props.item.status === 'pending' || props.item.status === 'processing') {
    return <div>Please wait for the link to complete</div>
  } else if (props.item.status === 'waiting') {
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
