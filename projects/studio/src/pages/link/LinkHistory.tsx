import { assertUnreachable } from '@rebel/shared/util/typescript'
import { sortBy } from '@rebel/shared/util/arrays'
import { PublicLinkHistoryItem } from '@rebel/api-models/public/user/PublicLinkHistoryItem'
import { capitaliseWord } from '@rebel/shared/util/text'
import { CircularProgress, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Tooltip } from '@mui/material'
import CopyText from '@rebel/studio/components/CopyText'
import useRequest from '@rebel/studio/hooks/useRequest'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import { deleteLinkToken, getLinkHistory } from '@rebel/studio/utility/api'
import ApiError from '@rebel/studio/components/ApiError'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'
import { getChannelUrlFromPublic } from '@rebel/shared/util/channel'
import { Delete } from '@mui/icons-material'
import { PublicStreamerSummary } from '@rebel/api-models/public/streamer/PublicStreamerSummary'

type Props = {
  updateKey: number
  admin_selectedAggregateUserId: number | undefined
  chatMateStreamer: PublicStreamerSummary | null
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
  const showLinkTokenColumn = items.some(link => link.token != null)

  return <>
    {header}
    {getLinkHistoryRequest.data != null &&
      <Table
        stickyHeader
        size="small"
        style={{ maxWidth: 1200, transform: 'translateY(-5px)' }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Channel</TableCell>
            <TableCell>Platform</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Link status</TableCell>
            {showLinkTokenColumn && <TableCell>Link token</TableCell>}
            <TableCell>Message</TableCell>
            <TableCell>Date</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tokens.map((item, i) => <LinkTokenRow key={i} item={item} chatMateStreamer={props.chatMateStreamer} showLinkTokenColumn={showLinkTokenColumn} onRefresh={props.onRefresh} />)}
        </TableBody>
      </Table>
    }

    <ApiLoading requestObj={getLinkHistoryRequest} initialOnly />
    <ApiError requestObj={getLinkHistoryRequest} />
  </>
}

function LinkTokenRow (props: { item: PublicLinkHistoryItem, chatMateStreamer: PublicStreamerSummary | null, showLinkTokenColumn: boolean, onRefresh: () => void }) {
  const item = props.item
  const { data, isLoading, triggerRequest } = useRequest(deleteLinkToken(item.token!), {
    onDemand: true,
    onError: error => window.alert(error.message),
    onSuccess: () => props.onRefresh()
  })
  const canDelete = item.status === 'waiting'

  return (
    <TableRow>
      <TableCell><a href={getChannelUrlFromPublic(item)}>{item.displayName}</a></TableCell>
      <TableCell>{item.platform === 'youtube' ? 'YouTube' : item.platform === 'twitch' ? 'Twitch' : assertUnreachable(item.platform)}</TableCell>
      <TableCell>{capitaliseWord(item.type)}</TableCell>
      <TableCell>{item.status}</TableCell>
      {props.showLinkTokenColumn && <TableCell>{item.token ?? 'Initiated manually'}</TableCell>}
      <TableCell><ItemMessage item={item} chatMateStreamer={props.chatMateStreamer} /></TableCell>
      <TableCell>{item.dateCompleted == null ? '' : new Date(item.dateCompleted).toLocaleString()}</TableCell>
      <TableCell>
        {canDelete && (
          <Tooltip title="Delete this link token">
            <span>
              <IconButton disabled={data != null} onClick={isLoading ? undefined : triggerRequest}>
                {isLoading ? <CircularProgress size="1rem" /> : <Delete />}
              </IconButton>
            </span>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  )
}

function ItemMessage (props: { item: PublicLinkHistoryItem, chatMateStreamer: PublicStreamerSummary | null }) {
  const command = `!link ${props.item.token}`

  if (props.item.message != null) {
    return <div>{props.item.message}</div>
  } else if (props.item.status === 'pending' || props.item.status === 'processing') {
    return <div>Please wait for the link to complete</div>
  } else if (props.item.status === 'waiting') {

    let channelUrl: string | null = null
    if (props.chatMateStreamer != null) {
      if (props.item.platform === 'youtube' && props.chatMateStreamer.youtubeChannel != null) {
        channelUrl = props.chatMateStreamer.currentYoutubeLivestream?.livestreamLink ?? getChannelUrlFromPublic(props.chatMateStreamer.youtubeChannel)
      } else if (props.item.platform === 'twitch' && props.chatMateStreamer.twitchChannel != null) {
        channelUrl = getChannelUrlFromPublic(props.chatMateStreamer.twitchChannel)
      }
    }

    return <>
      <div style={{ display: 'block' }}>
        <div>Initiate the link by pasting the command {channelUrl != null && <LinkInNewTab href={channelUrl}>here</LinkInNewTab>} (or in any other ChatMate streamer's chat)</div>
        <code>{command}</code>
        <CopyText text={command} tooltip="Copy command to clipboard" sx={{ ml: 1 }} />
      </div>
    </>
  } else {
    return <div>n/a</div>
  }
}
