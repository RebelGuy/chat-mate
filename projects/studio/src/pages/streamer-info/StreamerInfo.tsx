import { Alert } from '@mui/material'
import { Box } from '@mui/system'
import ApiError from '@rebel/studio/components/ApiError'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import RelativeTime from '@rebel/studio/components/RelativeTime'
import StreamerLinks from '@rebel/studio/components/StreamerLinks'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import useRequest from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import LivestreamHistory from '@rebel/studio/pages/streamer-info/LivestreamHistory'
import { getLivestreams } from '@rebel/studio/utility/api'
import { isStreamerLive } from '@rebel/studio/utility/misc'
import { useContext, useEffect } from 'react'

export default function StreamerInfo () {
  const loginContext = useContext(LoginContext)
  const [updateKey, onIncrementKey] = useUpdateKey()
  const getLivestreamsRequest = useRequest(getLivestreams(), { updateKey })

  useEffect(() => {
    loginContext.refreshData('streamerList')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshButton = (
    <RefreshButton
      isLoading={loginContext.loadingData.includes('streamerList') || getLivestreamsRequest.isLoading}
      onRefresh={() => {
        loginContext.refreshData('streamerList')
        onIncrementKey()
      }}
    />
  )
  const header = <PanelHeader>Streamer Info {refreshButton}</PanelHeader>

  const info = loginContext.allStreamers.find(streamer => streamer.username === loginContext.streamer)
  if (info == null) {
    return <>
      {header}
      <Alert severity="error">Invalid streamer selected.</Alert>
    </>
  } else if (info.youtubeChannel == null && info.twitchChannel == null) {
    return <>
      {header}
      Streamer <b>{loginContext.streamer}</b> has not yet set up their primary livestream channels for ChatMate. Please check back later.
    </>
  }

  return <>
    {header}

    <Box sx={{ mb: 2 }}>
      <b>{loginContext.streamer}</b> is {isStreamerLive(info) ? <>
        livestreaming on {info.youtubeChannel != null && info.twitchChannel != null ? 'YouTube and Twitch' : info.youtubeChannel != null ? 'YouTube' : 'Twitch'} since <RelativeTime time={info.currentYoutubeLivestream?.startTime ?? info.currentTwitchLivestream!.startTime!} /> ago.
      </> : <>
        not currently livestreaming. Please check back later.
      </>}
    </Box>

    <StreamerLinks streamerName={loginContext.streamer!} />
    {getLivestreamsRequest.data != null && <Box sx={{ mt: 2 }}>
      <LivestreamHistory livestreams={getLivestreamsRequest.data!.aggregateLivestreams} />
    </Box>}

    <ApiError requestObj={getLivestreamsRequest} />
  </>
}
