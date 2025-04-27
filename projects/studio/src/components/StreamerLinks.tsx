import { Box, Button } from '@mui/material'
import { PublicStreamerSummary } from '@rebel/api-models/public/streamer/PublicStreamerSummary'
import { ChatMateError } from '@rebel/shared/util/error'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { useContext } from 'react'

type Props = {
  streamerName: string
} | {
  streamerSummary: PublicStreamerSummary
}

export default function StreamerLinks (props: Props) {
  const loginContext = useContext(LoginContext)

  let streamerSummary: PublicStreamerSummary | undefined
  let streamerName: string
  if ('streamerSummary' in props) {
    streamerSummary = props.streamerSummary
    streamerName = streamerSummary.username
  } else {
    streamerName = props.streamerName
    streamerSummary = loginContext.allStreamers.find(streamer => streamer.username === streamerName)
  }

  if (streamerSummary == null) {
    throw new ChatMateError(`Unable to get info for streamer ${streamerName}`)
  }

  return <>
    <Box>
      {streamerSummary.youtubeChannel != null && <>
        <LinkInNewTab href={streamerSummary.currentYoutubeLivestream?.livestreamLink ?? streamerSummary.youtubeChannel.channelUrl} hideTextDecoration sx={{ mr: 2 }}>
          <Button>
            {streamerSummary.displayName ?? streamerSummary.username} on YouTube
          </Button>
        </LinkInNewTab>
      </>}
      {streamerSummary.twitchChannel != null && <>
        <LinkInNewTab href={streamerSummary.twitchChannel.channelUrl} hideTextDecoration>
          <Button>
            {streamerSummary.displayName ?? streamerSummary.username} on Twitch
          </Button>
        </LinkInNewTab>
      </>}
    </Box>
  </>
}
