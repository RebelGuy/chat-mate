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
import AccountHelpers from '@rebel/server/helpers/AccountHelpers'
import { InvalidUsernameError } from '@rebel/shared/util/error'
import AutoFocus from '@rebel/studio/components/Autofocus'

const accountHelpers = new AccountHelpers()

// by combining the login/registration form into a single component, we can easily handle redirects after the user logs in/registers
export default function LoginForm () {
  const loginContext = useContext(LoginContext)
  const [username, onSetUsername] = useState('')
  const [password, onSetPassword] = useState('')
  const [confirmedPassword, onSetConfirmedPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(true)
  const [isNewUser, setIsNewUser] = useState(false)
  const navigate = useNavigate()

  const onSuccess = (loginToken: string) => {
    loginContext.setLogin(username, loginToken)
    navigate(generatePath('/'))
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
    void tryLogin()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmitForm = async (): Promise<LoginResponse | RegisterResponse> => {
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

  let userNameError: string | null = null
  if (!isNullOrEmpty(username)) {
    try {
      accountHelpers.validateAndFormatUsername(username)
    } catch (e) {
      if (e instanceof InvalidUsernameError) {
        userNameError = e.message
      } else {
        throw e
      }
    }
  }

  const disableButton = isNullOrEmpty(username) || isNullOrEmpty(password) || (isNewUser && password !== confirmedPassword) || userNameError != null

  return (
    <div style={{ width: 'fit-content', margin: 'auto' }}>
      <ApiRequestTrigger isAnonymous hideRetryOnError onRequest={() => onSubmitForm()}>
        {(onMakeRequest, responseData, loadingNode, errorNode) => (
          <Form onSubmit={onMakeRequest} style={{ display: 'flex', flexDirection: 'column' }}>
            <AutoFocus>
              {(onRef) => (
                <TextField
                  label="Username"
                  disabled={loadingNode != null || loggingIn}
                  error={userNameError != null}
                  helperText={userNameError}
                  sx={{ width: 350, mt: 2 }}
                  inputRef={onRef}
                  onChange={e => onSetUsername(e.target.value)}
                />
              )}
            </AutoFocus>
            <TextField
              label="Password"
              type="password"
              disabled={loadingNode != null || loggingIn}
              sx={{ width: 350, mt: 2 }}
              onChange={e => onSetPassword(e.target.value)}
            />
            {isNewUser && (
              <TextField
                label="Confirm password"
                onChange={e => onSetConfirmedPassword(e.target.value)}
                disabled={loadingNode != null || loggingIn}
                sx={{ maxWidth: 350, mt: 2 }}
                type="password"
              />
            )}
            <FormControlLabel
              label="I am a new user"
              sx={{ mt: 2 }}
              control={
                <Checkbox
                  checked={isNewUser}
                  onChange={() => setIsNewUser(!isNewUser)}
                  disabled={loadingNode != null || loggingIn}
                />
              }
            />
            <Button
              type="submit"
              disabled={disableButton || loadingNode != null || loggingIn}
              sx={{ mt: 2, mb: 2 }}
              onClick={onMakeRequest}
            >
              {isNewUser ? 'Create account' : 'Login'}
            </Button>
            {loadingNode}
            {errorNode}
          </Form>
        )}
      </ApiRequestTrigger>
    </div>
  )
}
