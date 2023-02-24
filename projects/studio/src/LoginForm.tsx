import { LoginResponse } from '@rebel/server/controllers/AccountController'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { login } from '@rebel/studio/utility/api'
import ApiRequestTrigger from '@rebel/studio/components/ApiRequestTrigger'
import Form from '@rebel/studio/components/Form'
import { LoginContext } from '@rebel/studio/contexts/LoginProvider'
import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoginForm () {
  const loginContext = useContext(LoginContext)
  const [username, onSetUsername] = useState('')
  const [password, onSetPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(true)
  const navigate = useNavigate()

  const disableButton = isNullOrEmpty(username) || isNullOrEmpty(password)

  const onSuccess = (loginToken: string) => {
    loginContext.setLogin(username, loginToken)
  }

  useEffect(() => {
    const tryLogin = async () => {
      setLoggingIn(true)
      const result = await loginContext.login()
      if (result) {
        navigate('/')
      }
      setLoggingIn(false)
    }
    tryLogin()
  }, [loginContext, navigate])

  const onLogin = async (username: string, password: string, onSuccess: (loginToken: string) => void): Promise<LoginResponse> => {
    const result = await login(username, password)
  
    if (result.success) {
      onSuccess(result.data.loginToken)

      if (loginContext.streamer == null && result.data.isStreamer) {
        loginContext.setStreamer(loginContext.username)
      }
    }
  
    return result
  }

  return (
    <ApiRequestTrigger isAnonymous onRequest={() => onLogin(username, password, onSuccess)}>
      {(onMakeRequest, responseData, loadingNode, errorNode) => (
        <>
          {/* return false to prevent the page from refreshing */}
          <Form onSubmit={onMakeRequest}>
            <input type="text" placeholder="Username" value={username} onChange={e => onSetUsername(e.target.value)} disabled={loadingNode != null || loggingIn} />
            <input type="password" placeholder="Password" value={password} onChange={e => onSetPassword(e.target.value)} disabled={loadingNode != null || loggingIn} />
            <button type="submit" disabled={disableButton || loadingNode != null || loggingIn} onClick={onMakeRequest}>Login</button>
            {loadingNode}
            {errorNode}
          </Form>
          <button disabled={loggingIn} onClick={() => navigate('/register')}>Register for an account</button>
        </>
      )}
    </ApiRequestTrigger>
  )
}
