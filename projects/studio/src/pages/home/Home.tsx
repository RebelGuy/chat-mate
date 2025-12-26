import { Alert, Box, Button, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import CentredLoadingSpinner from '@rebel/studio/components/CentredLoadingSpinner'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'
import LinkToPage from '@rebel/studio/components/LinkToPage'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import ChatMateStats from '@rebel/studio/pages/home/ChatMateStats'
import { PageEmojis, PageLink, PageLogin } from '@rebel/studio/pages/navigation'
import { useContext, useState } from 'react'
import { generatePath, Link } from 'react-router-dom'

const EMBEDDED_VIDEO_WIDTH = 560
const EMBEDDED_VIDEO_HEIGHT = 315

export default function Home () {
  const loginContext = useContext(LoginContext)
  const [loadedVideo, setLoadedVideo] = useState(false)
  const loginPath = generatePath(PageLogin.path)
  const [visitorType, setVisitorType] = useState<'viewer' | 'streamer' | 'developer' | null>('viewer')

  const onSetVisitorType = (_: any, newType: 'viewer' | 'streamer' | 'developer' | null) => {
    if (newType != null) {
      setVisitorType(newType)
    }
  }

  return (
    <Box>
      <Box>
        <PanelHeader>Welcome</PanelHeader>
        <Typography>ChatMate is a free helper tool for livestreamers and viewers.</Typography>

        <ToggleButtonGroup
          value={visitorType}
          onChange={onSetVisitorType}
          exclusive
          sx={{ m: 2 }}
        >
          <ToggleButton value="viewer">
            I am a viewer
          </ToggleButton>
          <ToggleButton value="streamer">
            I am a livestreamer
          </ToggleButton>
          <ToggleButton value="developer">
            I am a developer
          </ToggleButton>
        </ToggleButtonGroup>

        {visitorType === 'viewer' && <Box>
          <Typography>
            ChatMate offers an enhanced viewing experience on Youtube and Twitch by bringing the streamer and viewer closer together.
          </Typography>
          <ul>
            <li>Increase your chat level by participating in the live chat.</li>
            <li>Check your streamer's {loginContext.streamer != null ? <LinkToPage page={PageEmojis} streamer={loginContext.streamer} label="custom emojis" /> : 'custom emojis'} and use them during their livestreams.</li>
            <li>Donate to a streamer to unlock unique perks.</li>
            <li>Create a free ChatMate account, then <LinkToPage page={PageLink} external label="link"/> your Youtube/Twitch channel to see your ranks and current level right here!</li>
          </ul>
        </Box>}

        {visitorType === 'streamer' && <Box>
          <Typography>
            ChatMate is available for streamers on Youtube and/or Twitch (multi-streaming is supported).
          </Typography>
          <Typography>
            A free Minecraft 1.8.9 integration exists for seamlessly interacting with viewers from within Minecraft - refer to the <LinkInNewTab href="https://github.com/RebelGuy/chat-mate-client/blob/master/docs/streamer-guide.md">Streamer Guide (Minecraft Mod)</LinkInNewTab>.
          </Typography>
          <ul>
            <li>View your live chat right within Minecraft.</li>
            <li>Manager user punishments from right within your game.</li>
            <li>Donations are shown via a dropdown card.</li>
            <li>A status indicator displays the current live status and viewer count.</li>
            <li>Add customisable native HUD elements to your game, such as countdowns, trackers, and free-form text.</li>
            <li>For more information on how to get started, refer to the <LinkInNewTab href="https://github.com/RebelGuy/chat-mate/blob/master/docs/streamer-guide.md">Streamer Guide</LinkInNewTab>.</li>
          </ul>
        </Box>}

        {visitorType === 'developer' && <Box>
          <Typography>
            ChatMate offers a rich suite of REST API endpoints and Websocket connectivity for 3rd party developers.
          </Typography>
          <ul>
            <li>API docs are available <LinkInNewTab href="https://github.com/RebelGuy/chat-mate/tree/master/projects/server#api-endpoints">here</LinkInNewTab>.</li>
            <li>It exposes data and functionality that allows it to be integrated into any game, application, or website - see an example implementation in Minecraft 1.8.9 <LinkInNewTab href="https://github.com/RebelGuy/chat-mate-client/tree/master">here</LinkInNewTab>.</li>
            <li>The core server is entirely open source, as is the code for this website, available on <LinkInNewTab href="https://github.com/RebelGuy/chat-mate-client/tree/master">Github</LinkInNewTab>.</li>
          </ul>
        </Box>}

        {loginContext.username == null && (
          <Alert severity="info" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ mr: 2 }}>Get started by logging in or creating a free account - it takes less than 10 seconds!</Typography>
              <Link to={loginPath} style={{ color: 'black', textDecoration: 'none' }}>
                <Button>
                  Let's go!
                </Button>
              </Link>
            </Box>
          </Alert>
        )}

        <Typography sx={{ mb: 1 }}>Want to find out more? Here is a demonstration of what ChatMate can do:</Typography>
        {!loadedVideo &&
          <Box style={{ width: EMBEDDED_VIDEO_WIDTH, height: EMBEDDED_VIDEO_HEIGHT, background: 'lightgrey' }}>
            <CentredLoadingSpinner />
          </Box>
        }
        <iframe
          style={{ display: loadedVideo ? 'block' : 'none' }}
          onLoad={() => setLoadedVideo(true)}
          width={EMBEDDED_VIDEO_WIDTH}
          height={EMBEDDED_VIDEO_HEIGHT}
          src="https://www.youtube.com/embed/LMikcMC21as"
          title="ChatMate Demonstration"
          frameBorder={0}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </Box>
      <Box>
        <ChatMateStats />
      </Box>
    </Box>
  )
}
