import { LogoutResponse } from '@rebel/server/controllers/AccountController'
import ApiRequestTrigger from '@rebel/studio/components/ApiRequestTrigger'
import RequireRank from '@rebel/studio/components/RequireRank'
import { LoginContext } from '@rebel/studio/contexts/LoginProvider'
import DebugInfo from '@rebel/studio/DebugInfo'
import SelectStreamer from '@rebel/studio/SelectStreamer'
import { logout } from '@rebel/studio/utility/api'
import React, { useContext } from 'react'
import { Link, Outlet } from 'react-router-dom'

export default function MainView () {
  const loginContext = useContext(LoginContext)
  const isLoggedIn = loginContext.loginToken != null

  return <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
    <RequireRank admin>
      <DebugInfo />
    </RequireRank>
    <h1>ChatMate</h1>

    {isLoggedIn && <>
        <div>
          Hi, <b>{loginContext.username}</b>!
        </div>
        <LogoutButton />
    </>}

    <nav>
      <ul>
        {/* todo: instead of hiding navigation items when not logged in/not selected a streamer, gray them out. need to make custom component and do some css magic */}
        {!isLoggedIn && <li><Link to="/login">Login</Link></li>}
        {loginContext.streamer != null && <li><Link to="/emojis">Emoji Manager</Link></li>}
        <RequireRank owner>
          <li><Link to="/manager">ChatMate Manager</Link></li>
        </RequireRank>
        <RequireRank admin>
          <li><Link to="/apply">ChatMate Beta Program</Link></li>
        </RequireRank>
        {isLoggedIn && <li><Link to="/link">Link Channels</Link></li>}
      </ul>
    </nav>

    <SelectStreamer />

    {/* content should fill the vertical space if less than 1 page */}
    <div style={{ flex: 1 }}>
      {/* placeholder component for the page that is currently selected */}
      <Outlet />
    </div>

    <div style={{ width: '100%', bottom: 8 }}>
      <em style={{ fontSize: 14 }}>This is a work in progress...</em>
    </div>
  </div>
}

function LogoutButton () {
  const loginContext = React.useContext(LoginContext)

  return (
    <ApiRequestTrigger onRequest={(loginToken: string) => doLogout(loginToken, () => loginContext.logout())}>
      {(onMakeRequest, responseData, loadingNode, errorNode) => (
        <>
          <button disabled={loadingNode != null} onClick={onMakeRequest} style={{ display: 'block', margin: 'auto' }}>Logout</button>
          {errorNode}
        </>
      )}
    </ApiRequestTrigger>
  )
}

async function doLogout (loginToken: string, onLogout: () => void): Promise<LogoutResponse> {
  const result = await logout(loginToken)
  onLogout()
  return result
}

// todo: auth flow: https://github.com/remix-run/react-router/blob/dev/examples/auth/src/App.tsx
