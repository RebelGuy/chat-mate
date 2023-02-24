import { PublicApiStatus } from '@rebel/server/controllers/public/status/PublicApiStatus'
import { getStatus, ping } from '@rebel/studio/utility/api'
import ApiRequest from '@rebel/studio/components/ApiRequest'
import * as React from 'react'

export default function ServerStatus () {
  const [pingStart, setPingStart] = React.useState(0)
  const [pingEnd, setPingEnd] = React.useState(0)
  const sendPing = () => {
    setPingStart(new Date().getTime())
    return ping().finally(() => setPingEnd(new Date().getTime()))
  }

  return (
    <>
      <ApiRequest onDemand={false} repeatInterval={5000} isAnonymous onRequest={sendPing}>
        {(data, loadingNode, errorNode) => <div style={{ color: data ? 'green' : errorNode ? 'red' : undefined }}>
          {data && `Server available (${pingEnd - pingStart}ms)`}
          {loadingNode && 'Checking availability'}
          {errorNode && `Server unavailable (${pingEnd - pingStart}ms)`}
        </div>}
      </ApiRequest>
      <ApiRequest onDemand={false} requiresStreamer repeatInterval={5000} onRequest={getStatus}>
        {status => <>
          <PlatformStatus status={status?.youtubeApiStatus} name="YouTube" />
          <PlatformStatus status={status?.twitchApiStatus} name="Twitch" />
        </>}
      </ApiRequest>
    </>
  )
}

function PlatformStatus (props: { status: PublicApiStatus | undefined, name: string }) {
  const status = props.status?.status
  const ping = props.status?.avgRoundtrip
  
  return <div>
    <div style={{ display: 'inline' }}>{props.name} API: </div>
    <div style={{ display: 'inline', color: status === 'ok' ? 'green' : 'red' }}>{status ?? 'unknown'}{ping && ` (${Math.round(ping)}ms)`}</div>
  </div>
}
