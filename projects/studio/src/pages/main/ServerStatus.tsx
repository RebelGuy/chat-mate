import { PublicApiStatus } from '@rebel/api-models/public/status/PublicApiStatus'
import { getStatus, ping } from '@rebel/studio/utility/api'
import ApiRequest from '@rebel/studio/components/ApiRequest'
import * as React from 'react'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import useRequest from '@rebel/studio/hooks/useRequest'

export default function ServerStatus () {
  const pingRef = React.useRef<number>(0)
  const [calculatedPing, setCalculatedPing] = React.useState(0)
  const [key] = useUpdateKey({ repeatInterval: 5000 })

  const { data: statusData, isLoading, error } = useRequest(getStatus(), { updateKey: key })
  const pingRequest = useRequest(ping(), {
    updateKey: key,
    onRequest: () => pingRef.current = Date.now(),
    onDone: () => setCalculatedPing(Date.now() - pingRef.current)
  })

  return (
    <>
      <div style={{ color: statusData != null ? 'green' : error != null ? 'red' : undefined }}>
        {statusData != null && `Server available (${calculatedPing}ms)`}
        {isLoading && statusData == null && 'Checking availability'}
        {error != null && `Server unavailable (${calculatedPing}ms)`}
      </div>
      <PlatformStatus status={statusData?.youtubeApiStatus} name="YouTube" />
      <PlatformStatus status={statusData?.twitchApiStatus} name="Twitch" />
    </>
  )
}

function PlatformStatus (props: { status: PublicApiStatus | undefined, name: string }) {
  const status = props.status?.status
  const platformPing = props.status?.avgRoundtrip

  return <div>
    <div style={{ display: 'inline' }}>{props.name} API: </div>
    <div style={{ display: 'inline', color: status === 'ok' ? 'green' : 'red' }}>{status ?? 'unknown'}{platformPing && ` (${Math.round(platformPing)}ms)`}</div>
  </div>
}
