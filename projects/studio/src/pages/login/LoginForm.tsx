import { LoginResponse, RegisterResponse } from '@rebel/server/controllers/AccountController'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { login, registerAccount } from '@rebel/studio/utility/api'
import ApiRequestTrigger from '@rebel/studio/components/ApiRequestTrigger'
import Form from '@rebel/studio/components/Form'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { useContext, useEffect, useState } from 'react'
import { generatePath, useNavigate } from 'react-router-dom'
import TextField from '@mui/material/TextField'
import { Button, Checkbox, FormControlLabel } from '@mui/material'

// by combining the login/registration form into a single component, we can easily handle redirects after the user logs in/registers
export default function LoginForm () {
  const loginContext = useContext(LoginContext)
  const [username, onSetUsername] = useState('')
  const [password, onSetPassword] = useState('')
  const [confirmedPassword, onSetConfirmedPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(true)
  const [isNewUser, setIsNewUser] = useState(false)
  const navigate = useNavigate()

  const disableButton = isNullOrEmpty(username) || isNullOrEmpty(password) || (isNewUser && password !== confirmedPassword)

  const onSuccess = (loginToken: string) => {
    loginContext.setLogin(username, loginToken)
  }

  useEffect(() => {
    const tryLogin = async () => {
      setLoggingIn(true)
      const result = await loginContext.login()
      if (result) {
        navigate(generatePath('/'))
      }
      setLoggingIn(false)
    }
    tryLogin()
  }, [loginContext, navigate])

  const onSubmitForm = async (isNewUser: boolean, username: string, password: string, onSuccess: (loginToken: string) => void): Promise<LoginResponse | RegisterResponse> => {
    if (isNewUser) {
      // registration
      const result = await registerAccount(username, password)

      if (result.success) {
        onSuccess(result.data.loginToken)
      }
      
      return result

    } else {
      // login
      const result = await login(username, password)
    
      if (result.success) {
        onSuccess(result.data.loginToken)

        if (loginContext.streamer == null && result.data.isStreamer) {
          loginContext.setStreamer(loginContext.username)
        }
      }
    
      return result
    }
  }

  return (
    <div style={{ width: 'fit-content', margin: 'auto' }}>
      <ApiRequestTrigger isAnonymous hideRetryOnError onRequest={() => onSubmitForm(isNewUser, username, password, onSuccess)}>
        {(onMakeRequest, responseData, loadingNode, errorNode) => (
          <Form onSubmit={onMakeRequest} style={{ display: 'flex', flexDirection: 'column' }}>
            <TextField label="Username" onChange={e => onSetUsername(e.target.value)} disabled={loadingNode != null || loggingIn} sx={{ width: 350, marginTop: 2 }} />
            <TextField label="Password" onChange={e => onSetPassword(e.target.value)} disabled={loadingNode != null || loggingIn} sx={{ width: 350, marginTop: 2 }} type="password" />
            {isNewUser && <TextField label="Confirm password" onChange={e => onSetConfirmedPassword(e.target.value)} disabled={loadingNode != null || loggingIn} sx={{ maxWidth: 350, marginTop: 2 }} type="password" value={confirmedPassword} />}
            <FormControlLabel control={<Checkbox checked={isNewUser} onChange={() => setIsNewUser(!isNewUser)} disabled={loadingNode != null || loggingIn} />} label="I am a new user" />
            <Button onClick={onMakeRequest} disabled={disableButton || loadingNode != null || loggingIn} type="submit" sx={{ marginTop: 2, marginBottom: 2 }}>{isNewUser ? 'Create account' : 'Login'}</Button>
            {loadingNode}
            {errorNode}
          </Form>
        )}
      </ApiRequestTrigger>
    </div>
  )
}
