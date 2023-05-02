import { Alert, Box } from '@mui/material'
import ApiError from '@rebel/studio/components/ApiError'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import RelativeTime from '@rebel/studio/components/RelativeTime'
import useRequest from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { getYoutubeStatus, getPrimaryChannels, getChatMateYoutubeChannel } from '@rebel/studio/utility/api'
import { getChannelDashboardUrl, getChannelUrl } from '@rebel/studio/utility/misc'

export default function YoutubeStatus () {
  const [refreshToken, updateRefreshToken] = useUpdateKey()
  const getYoutubeStatusRequest = useRequest(getYoutubeStatus(), { updateKey: refreshToken })
  const primaryChannelsRequest = useRequest(getPrimaryChannels(), { updateKey: refreshToken })
  const getChatMateYoutubeChannelRequest = useRequest(getChatMateYoutubeChannel(), { updateKey: refreshToken })

  return <>
    <PanelHeader>YouTube Status {<RefreshButton isLoading={getYoutubeStatusRequest.isLoading} onRefresh={updateRefreshToken} />}</PanelHeader>
    <ApiLoading requestObj={[getYoutubeStatusRequest, primaryChannelsRequest, getChatMateYoutubeChannelRequest]} initialOnly />
    <ApiError requestObj={[getYoutubeStatusRequest, primaryChannelsRequest, getChatMateYoutubeChannelRequest]} />

    {getYoutubeStatusRequest.data != null && primaryChannelsRequest.data != null && getChatMateYoutubeChannelRequest.data != null && <>
      <Box>
        In order to function properly, ChatMate requires that you add the&nbsp;
        <LinkInNewTab href={getChannelUrl(getChatMateYoutubeChannelRequest.data)}><b>{getChatMateYoutubeChannelRequest.data.displayName} YouTube channel</b></LinkInNewTab>
        &nbsp;to the standard moderator list (
        <LinkInNewTab href={getChannelDashboardUrl(getChatMateYoutubeChannelRequest.data)}>YouTube Studio</LinkInNewTab>
        &nbsp;-&gt; Settings -&gt; Community).
      </Box>

      <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
        Due to limitations with the current YouTube API that ChatMate is using, we are only able to
        check the moderator status at the time of the last received chat message in your latest livestream.
        The below status may be outdated and should be used as a guide only.
      </Alert>

      <Box>
        ChatMate is
        <Box display="inline" sx={{ color: getYoutubeStatusRequest.data.chatMateIsModerator ? 'green' : 'red' }}>{getYoutubeStatusRequest.data.chatMateIsModerator ? '' : 'not'} added as a moderator </Box>
        to your channel
        <Box display="inline" color="grey"> (as of {<RelativeTime time={getYoutubeStatusRequest.data.timestamp} />})</Box>.
      </Box>
    </>}
  </>
}
