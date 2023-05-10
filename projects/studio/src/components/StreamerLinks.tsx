import { Box, Button } from '@mui/material'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { useContext } from 'react'

type Props = {
  streamerName: string
}

export default function StreamerLinks (props: Props) {
  const loginContext = useContext(LoginContext)

  const { streamerName } = props

  const streamerSummary = loginContext.allStreamers.find(streamer => streamer.username === streamerName)
  if (streamerSummary == null) {
    throw new Error(`Unable to get info for streamer ${streamerName}`)
  }

  return <>
    <Box>
      {streamerSummary.youtubeChannel != null && <>
        <LinkInNewTab href={streamerSummary.currentLivestream?.livestreamLink ?? streamerSummary.youtubeChannel.channelUrl} hideTextDecoration sx={{ mr: 2 }}>
          <Button>
            {streamerName} on YouTube
          </Button>
        </LinkInNewTab>
      </>}
      {streamerSummary.twitchChannel != null && <>
        <LinkInNewTab href={streamerSummary.twitchChannel.channelUrl} hideTextDecoration>
          <Button>
            {streamerName} on Twitch
          </Button>
        </LinkInNewTab>
      </>}
    </Box>
  </>
}
