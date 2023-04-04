import { GetLinkHistoryResponse } from '@rebel/server/controllers/UserController'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import { sortBy } from '@rebel/shared/util/arrays'
import { PublicLinkHistoryItem } from '@rebel/server/controllers/public/user/PublicLinkHistoryItem'
import { capitaliseWord } from '@rebel/shared/util/text'
import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { getChannelUrl } from '@rebel/studio/utility/misc'
import CopyText from '@rebel/studio/components/CopyText'
import useRequest, { SuccessfulResponseData } from '@rebel/studio/hooks/useRequest'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import { getLinkHistory } from '@rebel/studio/utility/api'
import ApiError from '@rebel/studio/components/ApiError'
import ApiLoading from '@rebel/studio/components/ApiLoading'

type Props = {
  updateKey: number
  admin_selectedAggregateUserId: number | undefined
  onRefresh: () => void
}

export function LinkHistory (props: Props) {
  const getLinkHistoryRequest = useRequest(getLinkHistory(props.admin_selectedAggregateUserId), { updateKey: props.updateKey })

  const header = (
    <PanelHeader>Link History {<RefreshButton isLoading={getLinkHistoryRequest.isLoading} onRefresh={props.onRefresh} />}</PanelHeader>
  )

  if (getLinkHistoryRequest.data?.items.length === 0) {
    return <>
      {header}
      <div>
        No existing link attempts to show. Create a new link using the below input field.
      </div>
    </>
  }

  // show unfinished links first, then order completed links in descending order. kinda nasty but it works!
  const items = getLinkHistoryRequest.data?.items ?? []
  const maxDate = Math.max(...items.filter(item => item.dateCompleted != null).map(item => item.dateCompleted!))
  const tokens = sortBy(items, t => t.status === 'processing' || t.status === 'pending' ? 1 : t.status === 'waiting' ? 0 : maxDate + 1 - t.dateCompleted!)

  return <>
    {header}
    {getLinkHistoryRequest.data != null &&
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
    }

    <ApiLoading requestObj={getLinkHistoryRequest} initialOnly />
    <ApiError requestObj={getLinkHistoryRequest} />
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
