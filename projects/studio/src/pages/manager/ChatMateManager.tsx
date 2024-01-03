import ApiError from '@rebel/studio/components/ApiError'
import CentredLoadingSpinner from '@rebel/studio/components/CentredLoadingSpinner'
import useRequest from '@rebel/studio/hooks/useRequest'
import StreamlabsWebsocketForm from '@rebel/studio/pages/manager/StreamlabsWebsocketForm'
import TwitchEventStatuses from '@rebel/studio/pages/manager/TwitchEventStatuses'
import YoutubeLivestreamForm from '@rebel/studio/pages/manager/YoutubeLivestreamForm'
import YoutubeStatus from '@rebel/studio/pages/manager/YoutubeStatus'
import { getPrimaryChannels } from '@rebel/studio/utility/api'

export default function ChatMateManager () {
  const getPrimaryChannelsRequest = useRequest(getPrimaryChannels())

  if (getPrimaryChannelsRequest.error != null) {
    return <ApiError requestObj={getPrimaryChannelsRequest} />
  } else if (getPrimaryChannelsRequest.data == null && getPrimaryChannelsRequest.isLoading) {
    return <CentredLoadingSpinner sx={{ mt: 6 }} />
  }

  return <div style={{ display: 'block' }}>
    {getPrimaryChannelsRequest.data?.youtubeChannelId != null && <YoutubeLivestreamForm />}
    <StreamlabsWebsocketForm />
    {getPrimaryChannelsRequest.data?.youtubeChannelId != null && <YoutubeStatus />}
    {getPrimaryChannelsRequest.data?.twitchChannelId != null && <TwitchEventStatuses />}
  </div>
}
