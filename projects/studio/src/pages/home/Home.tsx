import { Box, Button, Typography } from '@mui/material'
import CentredLoadingSpinner from '@rebel/studio/components/CentredLoadingSpinner'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import ChatMateStats from '@rebel/studio/pages/home/ChatMateStats'
import { PageLogin } from '@rebel/studio/pages/navigation'
import { useContext, useState } from 'react'
import { generatePath, Link } from 'react-router-dom'

const EMBEDDED_VIDEO_WIDTH = 560
const EMBEDDED_VIDEO_HEIGHT = 315

export default function Home () {
  const loginContext = useContext(LoginContext)
  const [loadedVideo, setLoadedVideo] = useState(false)
  const loginPath = generatePath(PageLogin.path)

  return <>
    <Typography sx={{ mb: 2 }}>Welcome to <b>ChatMate</b>, a helper tool for livestreamers and viewers.</Typography>

    {loginContext.username == null && <Box sx={{ mb: 2 }}>
      <Typography>Get started by logging in or creating a free account - it takes less than 10 seconds!</Typography>
      <Link to={loginPath} style={{ color: 'black', textDecoration: 'none' }}>
        <Button>
          Let's go!
        </Button>
      </Link>
    </Box>}

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
    />

    <ChatMateStats />
  </>
}
