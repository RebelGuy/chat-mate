import ApiRequestTrigger from '@rebel/studio/components/ApiRequestTrigger'
import RequireRank from '@rebel/studio/components/RequireRank'
import RouteParamsObserver from '@rebel/studio/components/RouteParamsObserver'
import { LoginContext } from '@rebel/studio/contexts/LoginProvider'
import DebugInfo from '@rebel/studio/DebugInfo'
import { PageApply, PageChatMateManager, PageEmojis, PageLink, PageLogin } from '@rebel/studio/pages/navigation'
import SelectStreamer from '@rebel/studio/SelectStreamer'
import { logout } from '@rebel/studio/utility/api'
import React, { useContext } from 'react'
import { generatePath, Link, Outlet, useNavigate, useParams } from 'react-router-dom'

export default function MainView () {
  const loginContext = useContext(LoginContext)
  const { streamer: streamerParam } = useParams()

  const isInvalidStreamer = streamerParam != null && !loginContext.allStreamers.includes(streamerParam)
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
        {!isLoggedIn && <li><Link to={PageLogin.path}>{PageLogin.title}</Link></li>}
        {isLoggedIn && loginContext.streamer != null && <li><Link to={generatePath(PageEmojis.path, { streamer: loginContext.streamer })}>Emoji Manager</Link></li>}
        <RequireRank owner>
          <li><Link to={PageChatMateManager.path}>{PageChatMateManager.title}</Link></li>
        </RequireRank>
        <RequireRank admin>
          <li><Link to={PageApply.path}>{PageApply.title}</Link></li>
        </RequireRank>
        {isLoggedIn && <li><Link to={PageLink.path}>{PageLink.title}</Link></li>}
      </ul>
    </nav>

    <SelectStreamer />
    <RouteParamsObserver />

    {/* content should fill the vertical space if less than 1 page */}
    <div style={{ flex: 1 }}>
      {streamerParam != null && isInvalidStreamer ?
        <InvalidStreamer streamerName={streamerParam} />
        :
        // placeholder component for the page that is currently selected
        <Outlet />
      }
    </div>

    <div style={{ width: '100%', bottom: 8 }}>
      <em style={{ fontSize: 14 }}>This is a work in progress...</em>
    </div>
  </div>
}

function LogoutButton () {
  const loginContext = React.useContext(LoginContext)
  const navigate = useNavigate()

  const onLogout = async (loginToken: string) => {
    const result = await logout(loginToken)
    loginContext.logout()
    navigate(generatePath('/'))
    return result
  }

  return (
    <ApiRequestTrigger onRequest={onLogout}>
      {(onMakeRequest, responseData, loadingNode, errorNode) => (
        <>
          <button disabled={loadingNode != null} onClick={onMakeRequest} style={{ display: 'block', margin: 'auto' }}>Logout</button>
          {errorNode}
        </>
      )}
    </ApiRequestTrigger>
  )
}

function InvalidStreamer ({ streamerName }: { streamerName: string }) {
  return <>
    Unknown streamer <b>{streamerName}</b>.
  </>
}

// todo: auth flow: https://github.com/remix-run/react-router/blob/dev/examples/auth/src/App.tsx
