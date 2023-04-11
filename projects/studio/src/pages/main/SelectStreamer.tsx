import { Help } from '@mui/icons-material'
import { Alert, Box, FormControl, Icon, InputLabel, MenuItem, Select, Tooltip } from '@mui/material'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { pages } from '@rebel/studio/pages/navigation'
import { useContext, useEffect } from 'react'
import { generatePath, matchPath, useLocation, useNavigate, useParams } from 'react-router-dom'

export default function SelectStreamer () {
  const loginContext = useContext(LoginContext)
  const { pathname: currentPath } = useLocation()
  const navigate = useNavigate()
  const { streamer: streamerParam } = useParams()

  const isUnknownStreamer = streamerParam != null && loginContext.isHydrated && !loginContext.allStreamers.includes(streamerParam)

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

  if (loginContext.loginToken == null || loginContext.allStreamers.length === 0) {
    return null
  }

  return (
    <Box sx={{ mt: 2 }}>
      {isUnknownStreamer && <InvalidStreamer streamerName={streamerParam} />}
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <FormControl fullWidth>
          <InputLabel>Streamer</InputLabel>
          <Select error={isUnknownStreamer} value={loginContext.streamer ?? ''} onChange={e => loginContext.setStreamer(e.target.value)} label="Streamer">
            <MenuItem value=""><em>None</em></MenuItem>
            {loginContext.allStreamers.map(streamer => <MenuItem key={streamer} value={streamer}>{streamer}</MenuItem>)}
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

function InvalidStreamer ({ streamerName }: { streamerName: string }) {
  return <Alert severity="warning" sx={{ marginBottom: 2 }} >
    Unknown streamer <b>{streamerName}</b>.
  </Alert>
}
