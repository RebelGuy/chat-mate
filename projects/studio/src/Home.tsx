import { LogoutResponse } from '@rebel/server/controllers/AccountController'
import { logout } from '@rebel/studio/api'
import ApiRequestTrigger from '@rebel/studio/ApiRequestTrigger'
import { LoginContext } from '@rebel/studio/LoginProvider'
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
      {!isLoggedIn && <button onClick={() => props.onSelectPage('login')} style={{ display: 'block', margin: 'auto' }}>Login</button>}
      <button onClick={() => props.onSelectPage('customEmoji')} style={{ display: 'block', margin: 'auto' }}>Custom Emoji Manager</button>
      <button onClick={() => props.onSelectPage('chatMate')} style={{ display: 'block', margin: 'auto' }}>ChatMate Manager</button>
    </div>
  )
}

type LogoutButtonProps = {
}

function LogoutButton (props: LogoutButtonProps) {
  const loginContext = useContext(LoginContext)

  return (
    <ApiRequestTrigger onRequest={() => doLogout(() => loginContext.logout())}>
      {(onMakeRequest, responseData, loadingNode, errorNode) => (
        <>
          <button disabled={loadingNode != null} onClick={onMakeRequest} style={{ display: 'block', margin: 'auto' }}>Logout</button>
          {errorNode}
        </>
      )}
    </ApiRequestTrigger>
  )
}

async function doLogout (onLogout: () => void): Promise<LogoutResponse> { 
  const result = await logout()

  if (result.success) {
    onLogout()
  }

  return result
}
