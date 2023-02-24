import AuthenticationStatus from '@rebel/studio/AuthenticationStatus'
import { SERVER_URL } from '@rebel/studio/utility/global'
import ServerStatus from '@rebel/studio/ServerStatus'
import * as React from 'react'

export default function DebugInfo () {
  const [visible, setVisible] = React.useState(false)

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      padding: 8,
      textAlign: 'left',
      fontSize: 10,
      background: 'beige'
    }}>
      <div>
        <strong>Debug Info</strong>
        <div onClick={() => setVisible(!visible)} style={{ paddingLeft: 6, display: 'inline', cursor: 'pointer', float: 'right' }}>{visible ? '^' : 'v'}</div>
      </div>
      {visible && <>
        <a href={SERVER_URL}>Server</a>
        <ServerStatus />
        <AuthenticationStatus />
      </>}
    </div>
  )
}
