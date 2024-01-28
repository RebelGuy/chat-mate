import { Alert } from '@mui/material'
import ApiError from '@rebel/studio/components/ApiError'
import CentredLoadingSpinner from '@rebel/studio/components/CentredLoadingSpinner'
import useRequest from '@rebel/studio/hooks/useRequest'
import StreamlabsWebsocketForm from '@rebel/studio/pages/manager/StreamlabsWebsocketForm'
import TwitchEventStatuses from '@rebel/studio/pages/manager/TwitchEventStatuses'
import YoutubeLivestreamForm from '@rebel/studio/pages/manager/YoutubeLivestreamForm'
import YoutubeStatus from '@rebel/studio/pages/manager/YoutubeStatus'
import { PageLink, PageManager } from '@rebel/studio/pages/navigation'
import { getPrimaryChannels } from '@rebel/studio/utility/api'
import { Link } from 'react-router-dom'

export default function ChatMateManager () {
  const getPrimaryChannelsRequest = useRequest(getPrimaryChannels())

  if (getPrimaryChannelsRequest.error != null) {
    return <ApiError requestObj={getPrimaryChannelsRequest} />
  } else if (getPrimaryChannelsRequest.data == null && getPrimaryChannelsRequest.isLoading) {
    return <CentredLoadingSpinner sx={{ mt: 6 }} />
  }

  return <div style={{ display: 'block' }}>
    {getPrimaryChannelsRequest.data != null && getPrimaryChannelsRequest.data.youtubeChannelId == null && getPrimaryChannelsRequest.data.twitchChannelId == null && <NoPrimaryChannels />}
    {getPrimaryChannelsRequest.data?.youtubeChannelId != null && <YoutubeLivestreamForm />}
    {getPrimaryChannelsRequest.data?.youtubeChannelId != null && <YoutubeStatus />}
    {getPrimaryChannelsRequest.data?.twitchChannelId != null && <TwitchEventStatuses />}
    <StreamlabsWebsocketForm />
  </div>
}

export function NoPrimaryChannels () {
  return <Alert severity="warning">
    You do not have any primary channels set. Please go to the <Link to={PageLink.path}>{PageLink.title}</Link> page to indicate which Youtube and/or Twitch channel you will be streaming on.
  </Alert>
}
