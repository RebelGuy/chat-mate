import { LogoutResponse } from '@rebel/server/controllers/AccountController'
import { logout } from '@rebel/studio/api'
import ApiRequestTrigger from '@rebel/studio/ApiRequestTrigger'
import RequireRank from '@rebel/studio/components/RequireRank'
import { LoginContext } from '@rebel/studio/LoginProvider'
import SelectStreamer from '@rebel/studio/SelectStreamer'
import { Page } from '@rebel/studio/types'
import { useContext } from 'react'

type Props = {
  onSelectPage: (page: Page) => void
}

export default function Home (props: Props) {
  const loginContext = useContext(LoginContext)
  const isLoggedIn = loginContext.loginToken != null

  return (
    <div>
      {isLoggedIn && <>
        <div>
          Hi, <b>{loginContext.username}</b>!
        </div>
        <LogoutButton />
      </>}
      {!isLoggedIn && <button disabled={!loginContext.initialised} onClick={() => props.onSelectPage('login')} style={{ display: 'block', margin: 'auto' }}>Login</button>}
      <button disabled={loginContext.loginToken == null || loginContext.streamer == null} onClick={() => props.onSelectPage('customEmoji')} style={{ display: 'block', margin: 'auto' }}>Custom Emoji Manager</button>
      <RequireRank owner>
        <button disabled={loginContext.loginToken == null || loginContext.streamer == null} onClick={() => props.onSelectPage('chatMate')} style={{ display: 'block', margin: 'auto' }}>ChatMate Manager</button>
      </RequireRank>
      <RequireRank admin>
        <button disabled={loginContext.loginToken == null} onClick={() => props.onSelectPage('applyForStreamer')} style={{ display: 'block', margin: 'auto' }}>ChatMate Beta Program</button>
      </RequireRank>
      <button disabled={loginContext.loginToken == null} onClick={() => props.onSelectPage('linkUser')} style={{ display: 'block', margin: 'auto' }}>Link User</button>
      <SelectStreamer />
      <div style={{ position: 'absolute', bottom: 0, width: '100%', marginBottom: 8 }}>
        <em style={{ fontSize: 14 }}>This is a work in progress...</em>
      </div>
    </div>
  )
}

type LogoutButtonProps = {
}

function LogoutButton (props: LogoutButtonProps) {
  const loginContext = useContext(LoginContext)

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
