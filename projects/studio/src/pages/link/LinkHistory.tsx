import { assertUnreachable } from '@rebel/shared/util/typescript'
import { sortBy } from '@rebel/shared/util/arrays'
import { PublicLinkHistoryItem } from '@rebel/server/controllers/public/user/PublicLinkHistoryItem'
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
import { useContext } from 'react'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { getChannelUrlFromPublic } from '@rebel/server/models/user'
import { Delete } from '@mui/icons-material'

type Props = {
  updateKey: number
  admin_selectedAggregateUserId: number | undefined
  chatMateUsername: string | undefined
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
            <TableCell></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tokens.map(item => <LinkTokenRow key={item.token ?? item.externalIdOrUserName} item={item} chatMateUsername={props.chatMateUsername} onRefresh={props.onRefresh} />)}
        </TableBody>
      </Table>
    }

    <ApiLoading requestObj={getLinkHistoryRequest} initialOnly />
    <ApiError requestObj={getLinkHistoryRequest} />
  </>
}

function LinkTokenRow (props: { item: PublicLinkHistoryItem, chatMateUsername: string | undefined, onRefresh: () => void }) {
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
      <TableCell>{item.token ?? 'Initiated by admin'}</TableCell>
      <TableCell><ItemMessage item={item} chatMateUsername={props.chatMateUsername} /></TableCell>
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

function ItemMessage (props: { item: PublicLinkHistoryItem, chatMateUsername: string | undefined }) {
  const loginContext = useContext(LoginContext)
  const command = `!link ${props.item.token}`

  if (props.item.message != null) {
    return <div>{props.item.message}</div>
  } else if (props.item.status === 'pending' || props.item.status === 'processing') {
    return <div>Please wait for the link to complete</div>
  } else if (props.item.status === 'waiting') {
    const chatMateStreamer = loginContext.allStreamers.find(streamer => streamer.username === props.chatMateUsername)

    let channelUrl: string | null = null
    if (chatMateStreamer != null) {
      if (props.item.platform === 'youtube' && chatMateStreamer.youtubeChannel != null) {
        channelUrl = chatMateStreamer.currentLivestream?.livestreamLink ?? getChannelUrlFromPublic(chatMateStreamer.youtubeChannel)
      } else if (props.item.platform === 'twitch' && chatMateStreamer.twitchChannel != null) {
        channelUrl = getChannelUrlFromPublic(chatMateStreamer.twitchChannel)
      }
    }

    return <>
      <div style={{ display: 'block' }}>
        <div>Initiate the link by pasting the command {channelUrl != null && <LinkInNewTab href={channelUrl}>here</LinkInNewTab>}</div>
        <code>{command}</code>
        <CopyText text={command} tooltip="Copy command to clipboard" sx={{ ml: 1 }} />
      </div>
    </>
  } else {
    return <div>n/a</div>
  }
}
