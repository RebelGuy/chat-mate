import { LoginContext } from '@rebel/studio/LoginProvider'
import { useContext } from 'react'

type Props = {
}

export default function SelectStreamer (props: Props) {
  const loginContext = useContext(LoginContext)

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
