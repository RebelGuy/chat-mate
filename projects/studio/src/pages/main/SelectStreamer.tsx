import { Help } from '@mui/icons-material'
import { Alert, Box, FormControl, Icon, InputLabel, MenuItem, Select, Tooltip } from '@mui/material'
import { PublicStreamerSummary } from '@rebel/api-models/public/streamer/PublicStreamerSummary'
import { nonNull } from '@rebel/shared/util/arrays'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { pages } from '@rebel/studio/pages/navigation'
import { isLivestreamLive, isStreamerLive } from '@rebel/studio/utility/misc'
import { useContext, useEffect } from 'react'
import { generatePath, matchPath, useLocation, useNavigate, useParams } from 'react-router-dom'

export default function SelectStreamer () {
  const loginContext = useContext(LoginContext)
  const { pathname: currentPath } = useLocation()
  const navigate = useNavigate()
  const { streamer: streamerParam } = useParams()

  const selectedStreamer = streamerParam ?? loginContext.streamer
  const isUnknownStreamer = selectedStreamer != null && loginContext.isHydrated && !loginContext.allStreamers.some(s => s.username === selectedStreamer)

  useEffect(() => {
    const streamer = loginContext.streamer
    if (streamerParam == null || streamerParam === streamer || !loginContext.isHydrated) {
      return
    }

    // the streamer was deselected - redirect home
    if (isNullOrEmpty(streamer)) {
      navigate(generatePath('/'))
      return
    }

    // if we are currently in a streamer-specific page, we want to update the url to point to the new streamer
    for (const page of pages) {
      const match = matchPath({ path: page.path }, currentPath)
      if (match?.params.streamer != null) {
        navigate(generatePath(page.path, { ...match.params, streamer }))
        return
      }
    }
  }, [loginContext, navigate, currentPath, streamerParam])

  if (loginContext.allStreamers.length === 0) {
    return null
  }

  const currentStreamer = loginContext.allStreamers.find(streamer => streamer.username === loginContext.username)
  const liveStreamers = loginContext.allStreamers.filter(streamer => streamer.username !== loginContext.username && isStreamerLive(streamer))
  const otherStreamers = loginContext.allStreamers.filter(streamer => streamer.username !== loginContext.username && !isStreamerLive(streamer))
  const allStreamers = nonNull([currentStreamer, ...liveStreamers, ...otherStreamers])

  return (
    <Box sx={{ mt: 2 }}>
      {isUnknownStreamer && <InvalidStreamer streamerName={selectedStreamer} />}
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <FormControl fullWidth>
          <InputLabel>Streamer</InputLabel>
          <Select error={isUnknownStreamer} value={loginContext.streamer ?? ''} onChange={e => loginContext.setStreamer(e.target.value)} label="Streamer">
            <MenuItem value=""><em>None</em></MenuItem>
            {allStreamers.map(streamer => <MenuItem key={streamer.username} value={streamer.username}>{streamer.displayName ?? streamer.username}{getLiveIndicator(streamer)}</MenuItem>)}
          </Select>
        </FormControl>
        <div style={{ padding: 8, paddingTop: 16, margin: 'auto' }}>
          <Tooltip title="Select the streamer context under which to make requests.">
            <Icon color="info">
              <Help />
            </Icon>
          </Tooltip>
        </div>
      </div>
    </Box>
  )
}

function getLiveIndicator (streamer: PublicStreamerSummary): string {
  if (!isStreamerLive(streamer)) {
    return ''
  }

  let result = ''
  if (isLivestreamLive(streamer.currentYoutubeLivestream)) {
    result += ' 🔴'
  }
  if (isLivestreamLive(streamer.currentTwitchLivestream)) {
    result += ' 🟣'
  }

  return result
}

function InvalidStreamer ({ streamerName }: { streamerName: string }) {
  return <Alert severity="warning" sx={{ marginBottom: 2 }} >
    Unknown streamer <b>{streamerName}</b>.
  </Alert>
}
