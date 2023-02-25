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

  useEffect(() => {
    const streamer = loginContext.streamer
    if (streamerParam == null || streamerParam === streamer || loginContext.isLoading || !loginContext.initialised) {
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

  if (loginContext.loginToken == null) {
    return null
  }

  return (
    <div>
      <div>Select the streamer context under which to make requests.</div>
      <div>Currently selected: <b>{loginContext.streamer ?? 'n/a'}</b></div>
      <div>
        <select name="streamerSelection" value={loginContext.streamer ?? ''} onChange={e => loginContext.setStreamer(e.target.value)}>
          <option value=""></option>
          {loginContext.allStreamers.map(streamer => <option key={streamer} value={streamer}>{streamer}</option>)}
        </select>
      </div>
    </div>
  )
}
