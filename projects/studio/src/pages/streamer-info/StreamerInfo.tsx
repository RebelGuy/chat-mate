import { North, South } from '@mui/icons-material'
import { Alert, Tab, Tabs, Typography, styled } from '@mui/material'
import { Box } from '@mui/system'
import { PublicChannel } from '@rebel/api-models/public/user/PublicChannel'
import ApiError from '@rebel/studio/components/ApiError'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import RelativeTime from '@rebel/studio/components/RelativeTime'
import StreamerLinks from '@rebel/studio/components/StreamerLinks'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import useRequest from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import ChatHistory from '@rebel/studio/pages/streamer-info/ChatHistory'
import LivestreamHistory from '@rebel/studio/pages/streamer-info/LivestreamHistory'
import { getLivestreams } from '@rebel/studio/utility/api'
import { isStreamerLive } from '@rebel/studio/utility/misc'
import { useContext, useEffect, useRef, useState } from 'react'

export default function StreamerInfo () {
  const loginContext = useContext(LoginContext)
  const [tabValue, onSetTabValue] = useState<'chat' | 'livestreamHistory'>('chat')
  const [updateKey, onIncrementKey] = useUpdateKey()
  const getLivestreamsRequest = useRequest(getLivestreams(), { updateKey })
  const [chatDirection, setChatDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    loginContext.refreshData('streamerList')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onUpdateTabValue = (_: any, newValue: 'chat' | 'livestreamHistory') => {
    onSetTabValue(newValue)
  }

  const onClickChatTab = () => {
    if (tabValue !== 'chat' || chatDirection === 'desc') {
      setChatDirection('asc')
    } else {
      setChatDirection('desc')
    }
  }

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

  const chatDirectionArrow = tabValue === 'chat' ? (
    <Box display="inline" sx={{ marginRight: '-16px', paddingLeft: '4px' }}>
      {chatDirection === 'asc' ? <South sx={{ fontSize: 12 }} /> : <North sx={{ fontSize: 12 }} />}
    </Box>
  ) : null

  return <>
    {header}

    <Box sx={{ mb: 2 }}>
      <b>{info.displayName ?? info.username}</b> is {isStreamerLive(info) ? <>
        livestreaming on {info.youtubeChannel != null && info.twitchChannel != null ? 'YouTube and Twitch' : info.youtubeChannel != null ? 'YouTube' : 'Twitch'} since <RelativeTime time={info.currentYoutubeLivestream?.startTime ?? info.currentTwitchLivestream!.startTime!} /> ago.
      </> : <>
        not currently livestreaming. Please check back later.
      </>}
    </Box>

    <Box sx={{ pb: 2 }}>
      <StreamerLinks streamerName={loginContext.streamer!} />
    </Box>

    <Box display="inline">
      {/* we can only embed a youtube livestream, not a channel. there is supposedly a way to emebed a channel itself, but that is currently broken. */}
      {info.youtubeChannel != null && info.currentYoutubeLivestream && <EmbedYoutubeStream liveId={info.currentYoutubeLivestream.livestreamLink.split('/').at(-1)!} streamerName={info.youtubeChannel.displayName} />}
      {info.twitchChannel != null && <EmbedTwitchStream channel={info.twitchChannel} />}
    </Box>

    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={onUpdateTabValue}>
          <Tab label={<Box display="flex">Chat {chatDirectionArrow}</Box>} value="chat" onClick={onClickChatTab} />
          <Tab label="Livestream History" value="livestreamHistory" />
        </Tabs>
      </Box>
      {tabValue === 'chat' && loginContext.streamer != null && <ChatHistory streamer={loginContext.streamer} updateKey={updateKey} direction={chatDirection} />}
      {tabValue === 'livestreamHistory' && getLivestreamsRequest.data != null && <Box sx={{ mt: 2 }}>
        <LivestreamHistory livestreams={getLivestreamsRequest.data!.aggregateLivestreams} />
      </Box>}
    </Box>

    <ApiError requestObj={getLivestreamsRequest} />
  </>
}

type EmbedTwitchStreamProps = {
  channel: PublicChannel
}

declare global {
  const Twitch: any
}

const EmbedContainer = styled(Box)({
  width: '50%',
  minWidth: 364,
  maxWidth: 600,
  aspectRatio: '1.778', // 16:9
  display: 'inline-block',
  paddingRight: 20
})

// https://dev.twitch.tv/docs/embed/everything/
function EmbedTwitchStream (props: EmbedTwitchStreamProps) {
  const [scriptReady, setScriptReady] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const channelName = props.channel.externalIdOrUserName

  // load the embed script
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://embed.twitch.tv/embed/v1.js'
    script.onload = () => setScriptReady(true)
    document.body.append(script)

    return () => {
      script.remove()
    }
  }, [])

  // set up the video player
  useEffect(() => {
    if (!scriptReady) {
      return
    }

    const embeddedStream = new Twitch.Embed(containerRef.current, {
      width: '100%',
      height: '100%',
      channel: channelName,
      autoplay: false,
      muted: true,
      layout: 'video' // don't show chat
    })

    return () => {
      embeddedStream.destroy()
    }
  }, [channelName, scriptReady])

  // the video player will be rendered into this box
  return (
    <EmbedContainer
      ref={containerRef}
    />
  )
}

type EmbedYoutubeStreamProps = {
  streamerName: string
  liveId: string
}

function EmbedYoutubeStream (props: EmbedYoutubeStreamProps) {
  return (
    <EmbedContainer>
      <iframe
        title={`${props.streamerName}'s Youtube Livestream`}
        width="100%"
        height="100%"
        src={`https://www.youtube.com/embed/${props.liveId}?autoplay=0`}
        allowFullScreen
        style={{ border: 0 }}
        referrerPolicy="strict-origin-when-cross-origin"
      >
      </iframe>
    </EmbedContainer>
  )
}
