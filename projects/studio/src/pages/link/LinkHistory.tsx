import { GetLinkHistoryResponse } from '@rebel/server/controllers/UserController'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import { sortBy } from '@rebel/shared/util/arrays'
import * as React from 'react'
import { PublicLinkHistoryItem } from '@rebel/server/controllers/public/user/PublicLinkHistoryItem'
import { capitaliseWord } from '@rebel/shared/util/text'
import { IconButton, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { ContentCopy, Refresh } from '@mui/icons-material'
import { Box } from '@mui/system'
import { getChannelUrl } from '@rebel/studio/utility/misc'
import CopyText from '@rebel/studio/components/CopyText'

export function LinkHistory (props: { data: Extract<GetLinkHistoryResponse, { success: true }>['data'], onRefresh: () => void }) {
  const header = (
    <h3>Link History {<IconButton onClick={props.onRefresh}><Refresh /></IconButton>}</h3>
  )

  if (props.data.items.length === 0) {
    return <>
      {header}
      <div>
        No existing link attempts to show. Create a new link using the below input field.
      </div>
    </>
  }

  // show unfinished links first, then order completed links in descending order. kinda nasty but it works!
  const maxDate = Math.max(...props.data.items.filter(item => item.dateCompleted != null).map(item => item.dateCompleted!))
  const tokens = sortBy(props.data.items, t => t.status === 'processing' || t.status === 'pending' ? 1 : t.status === 'waiting' ? 0 : maxDate + 1 - t.dateCompleted!)

  return <>
    {header}
    <Table style={{ margin: 'auto' }}>
      <TableHead>
        <TableRow>
          <TableCell>Channel</TableCell>
          <TableCell>Platform</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Link status</TableCell>
          <TableCell>Link token</TableCell>
          <TableCell>Message</TableCell>
          <TableCell>Date</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {tokens.map((item, i) => (
          <TableRow key={i}>
            <TableCell><a href={getChannelUrl(item)}>{item.displayName}</a></TableCell>
            <TableCell>{item.platform === 'youtube' ? 'YouTube' : item.platform === 'twitch' ? 'Twitch' : assertUnreachable(item.platform)}</TableCell>
            <TableCell>{capitaliseWord(item.type)}</TableCell>
            <TableCell>{item.status}</TableCell>
            <TableCell>{item.token ?? 'Initiated by admin'}</TableCell>
            <TableCell><ItemMessage item={item} /></TableCell>
            <TableCell>{item.dateCompleted == null ? '' : new Date(item.dateCompleted).toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </>
}

function ItemMessage (props: { item: PublicLinkHistoryItem }) {
  const command = `!link ${props.item.token}`

  if (props.item.message != null) {
    return <div>{props.item.message}</div>
  } else if (props.item.status === 'pending' || props.item.status === 'processing') {
    return <div>Please wait for the link to complete</div>
  } else if (props.item.status === 'waiting') {
    return <>
      <div style={{ display: 'block' }}>
        <div>Initiate the link using the command</div>
        <code>{command}</code>
        <CopyText text={command} tooltip="Copy command to clipboard" sx={{ ml: 1 }} />
      </div>
    </>
  } else {
    return <div>n/a</div>
  }
}
