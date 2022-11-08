import { LoginResponse } from '@rebel/server/controllers/AccountController'
import { isNullOrEmpty } from '@rebel/server/util/strings'
import { login } from '@rebel/studio/api'
import ApiRequestTrigger from '@rebel/studio/ApiRequestTrigger'
import { LoginContext } from '@rebel/studio/LoginProvider'
import { useContext, useEffect, useState } from 'react'

type Props = {
  onBack: () => void
  onRegister: () => void
}

export default function LoginForm (props: Props) {
  const loginContext = useContext(LoginContext)
  const [username, onSetUsername] = useState('')
  const [password, onSetPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(true)

  const disableButton = isNullOrEmpty(username) || isNullOrEmpty(password)

  const onSuccess = (loginToken: string) => {
    loginContext.setLogin(username, loginToken)
    props.onBack()
  }

  useEffect(() => {
    const tryLogin = async () => {
      setLoggingIn(true)
      const result = await loginContext.login()
      if (result) {
        props.onBack()
      }
      setLoggingIn(false)
    }
    tryLogin()
  }, [])

  return (
    <ApiRequestTrigger isAnonymous onRequest={() => onLogin(username, password, onSuccess)}>
      {(onMakeRequest, responseData, loadingNode, errorNode) => (
        <>
          {/* return false to prevent the page from refreshing */}
          <form onSubmit={() => { onMakeRequest(); return false }}>
            <input type="text" placeholder="Username" value={username} onChange={e => onSetUsername(e.target.value)} disabled={loadingNode != null || loggingIn} />
            <input type="password" placeholder="Password" value={password} onChange={e => onSetPassword(e.target.value)} disabled={loadingNode != null || loggingIn} />
            <button type="submit" disabled={disableButton || loadingNode != null || loggingIn} onClick={onMakeRequest}>Login</button>
            {loadingNode}
            {errorNode}
          </form>
          <button disabled={loggingIn} onClick={props.onRegister}>Register for an account</button>
        </>
      )}
    </ApiRequestTrigger>
  )
}

async function onLogin (username: string, password: string, onSuccess: (loginToken: string) => void): Promise<LoginResponse> {
  const result = await login(username, password)

  if (result.success) {
    onSuccess(result.data.loginToken)
  }

  return result
}
