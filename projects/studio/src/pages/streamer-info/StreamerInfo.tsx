import { Button } from '@mui/material'
import { Box } from '@mui/system'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import RelativeTime from '@rebel/studio/components/RelativeTime'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { getChannelUrl, isLive } from '@rebel/studio/utility/misc'
import { useContext, useEffect } from 'react'

export default function StreamerInfo () {
  const loginContext = useContext(LoginContext)

  useEffect(() => {
    loginContext.refreshData('streamerList')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const info = loginContext.allStreamers.find(streamer => streamer.username === loginContext.streamer)
  if (info == null) {
    throw new Error(`Unable to get info for streamer ${loginContext.streamer}`)
  }

  const header = <PanelHeader>Streamer Info {<RefreshButton isLoading={loginContext.loadingData.includes('streamerList')} onRefresh={() => loginContext.refreshData('streamerList')} />}</PanelHeader>

  if (info.youtubeChannel == null && info.twitchChannel == null) {
    return <>
      {header}
      Streamer <b>{loginContext.streamer}</b> has not yet set up their primary livestream channels for ChatMate. Please check back later.
    </>
  }

  return <>
    {header}

    <Box sx={{ mb: 2 }}>
      <b>{loginContext.streamer}</b> is {isLive(info.currentLivestream) ? <>
        livestreaming on {info.youtubeChannel != null && info.twitchChannel != null ? 'YouTube and Twitch' : info.youtubeChannel != null ? 'YouTube' : 'Twitch'} since <RelativeTime time={info.currentLivestream!.startTime!} />.
      </> : <>
        not currently livestreaming. Please check back later.
      </>}
    </Box>

    <Box>
      {info.youtubeChannel != null && <>
        <Button href={getChannelUrl(info.youtubeChannel)} sx={{ mr: 2 }}>
          {loginContext.streamer} on YouTube
        </Button>
      </>}
      {info.twitchChannel != null && <>
        <Button href={getChannelUrl(info.twitchChannel)}>
          {loginContext.streamer} on Twitch
        </Button>
      </>}
    </Box>
  </>
}
