import { getStreamers } from '@rebel/studio/api'
import ApiRequest from '@rebel/studio/ApiRequest'
import { LoginContext } from '@rebel/studio/LoginProvider'
import { useContext } from 'react'

type Props = {
}

export default function SelectStreamer (props: Props) {
  const loginContext = useContext(LoginContext)

  if (loginContext.loginToken == null) {
    return null
  }

  const onGetStreamers = async (loginToken: string) => {
    const result = await getStreamers(loginToken)

    if (result.success && loginContext.username != null && result.data.streamers.includes(loginContext.username)) {
      loginContext.setIsStreamer(true)
    } else {
      loginContext.setIsStreamer(false)
    }

    return result
  }

  return (
    <div>
      <div>Select the streamer context under which to make requests.</div>
      <div>Currently selected: <b>{loginContext.streamer ?? 'n/a'}</b></div>
      <div>
        <ApiRequest onDemand token={1} onRequest={onGetStreamers}>
          {(response, loadingNode, errorNode) => <>
            {response && (
              <select name="streamerSelection" value={loginContext.streamer ?? ''} onChange={e => loginContext.setStreamer(e.target.value)}>
                <option value=""></option>
                {response.streamers.map(streamer => <option key={streamer} value={streamer}>{streamer}</option>)}
              </select>
            )}
            {loadingNode}
            {errorNode}
          </>}
        </ApiRequest>
      </div>
    </div>
  )
}