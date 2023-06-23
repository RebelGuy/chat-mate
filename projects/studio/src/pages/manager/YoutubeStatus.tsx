import { Alert, Box } from '@mui/material'
import { getChannelUrlFromPublic } from '@rebel/shared/util/channel'
import ApiError from '@rebel/studio/components/ApiError'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import RelativeTime from '@rebel/studio/components/RelativeTime'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import useRequest from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { getYoutubeStatus, getChatMateRegisteredUsername } from '@rebel/studio/utility/api'
import { useContext } from 'react'

export default function YoutubeStatus () {
  const loginContext = useContext(LoginContext)
  const [refreshToken, updateRefreshToken] = useUpdateKey()
  const getYoutubeStatusRequest = useRequest(getYoutubeStatus(), { updateKey: refreshToken })
  const getChatMateRegisteredUsernameRequest = useRequest(getChatMateRegisteredUsername())

  const chatMateInfo = loginContext.allStreamers.find(streamer => streamer.username === getChatMateRegisteredUsernameRequest.data?.username)

  return <>
    <PanelHeader>YouTube Status {<RefreshButton isLoading={getYoutubeStatusRequest.isLoading} onRefresh={updateRefreshToken} />}</PanelHeader>

    <Box>
      In order to function properly, ChatMate requires that you add the&nbsp;
      <LinkInNewTab href={chatMateInfo != null ? getChannelUrlFromPublic(chatMateInfo.youtubeChannel!) : ''}><b>{chatMateInfo?.youtubeChannel!.displayName ?? 'ChatMate'}</b></LinkInNewTab>
      &nbsp;YouTube channel to the standard moderator list (
      <LinkInNewTab href="https://studio.youtube.com/">YouTube Studio</LinkInNewTab>
      &nbsp;-&gt; Settings -&gt; Community).
    </Box>

    <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
      Due to limitations with the current YouTube API that ChatMate is using, we are only able to
      check the moderator status at the time of the last received chat message in your latest livestream
      that was sent by a non-moderator user.
      The below status may be outdated and should be used as a guide only.
    </Alert>

    <ApiLoading requestObj={[getYoutubeStatusRequest, getChatMateRegisteredUsernameRequest]} initialOnly />
    <ApiError requestObj={[getYoutubeStatusRequest, getChatMateRegisteredUsernameRequest]} />

    {getYoutubeStatusRequest.data != null && getChatMateRegisteredUsernameRequest.data != null && <>
      <Box>
        ChatMate is
        <Box display="inline" sx={{ color: getYoutubeStatusRequest.data.chatMateIsModerator ? 'green' : 'red' }}>{getYoutubeStatusRequest.data.chatMateIsModerator ? '' : ' not'} added as a moderator </Box>
        to your channel
        <Box display="inline" color="grey"> (as of {<RelativeTime time={getYoutubeStatusRequest.data.timestamp} />})</Box>.
      </Box>
    </>}
  </>
}
