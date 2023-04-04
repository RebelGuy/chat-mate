import { LoginResponse, RegisterResponse } from '@rebel/server/controllers/AccountController'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { login, registerAccount } from '@rebel/studio/utility/api'
import Form from '@rebel/studio/components/Form'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { useContext, useEffect, useState } from 'react'
import { generatePath, useNavigate } from 'react-router-dom'
import TextField from '@mui/material/TextField'
import { Button, Checkbox, FormControlLabel } from '@mui/material'
import AccountHelpers from '@rebel/server/helpers/AccountHelpers'
import { InvalidUsernameError } from '@rebel/shared/util/error'
import AutoFocus from '@rebel/studio/components/Autofocus'
import useRequest, { RequestType, SuccessfulResponseData } from '@rebel/studio/hooks/useRequest'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'

const accountHelpers = new AccountHelpers()

// by combining the login/registration form into a single component, we can easily handle redirects after the user logs in/registers
export default function LoginForm () {
  const loginContext = useContext(LoginContext)
  const [username, onSetUsername] = useState('')
  const [password, onSetPassword] = useState('')
  const [confirmedPassword, onSetConfirmedPassword] = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const navigate = useNavigate()

  const onSuccess = (data: SuccessfulResponseData<RegisterResponse | LoginResponse>, type: RequestType) => {
    loginContext.setLogin(username, data.loginToken)
    navigate(generatePath('/'))

    if ('isStreamer' in data && loginContext.streamer == null && data.isStreamer) {
      loginContext.setStreamer(username)
    }
  }

  const registerRequest = useRequest(registerAccount({ username, password }), { onDemand: true, onSuccess })
  const loginRequest = useRequest(login({ username, password }), { onDemand: true, onSuccess })

  // we don't want to show the login page if the user is already logged in
  useEffect(() => {
    if (loginContext.loginToken != null) {
      navigate(generatePath('/'))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const isLoading = loginRequest.isLoading || registerRequest.isLoading || loginContext.isLoading
  const onSubmit = isNewUser ? registerRequest.triggerRequest : loginRequest.triggerRequest

  return (
    <div style={{ width: 'fit-content', margin: 'auto' }}>
      <Form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
        <AutoFocus>
          {(onRef) => (
            <TextField
              label="Username"
              disabled={isLoading}
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
          disabled={isLoading}
          sx={{ width: 350, mt: 2 }}
          onChange={e => onSetPassword(e.target.value)}
        />
        {isNewUser && (
          <TextField
            label="Confirm password"
            onChange={e => onSetConfirmedPassword(e.target.value)}
            disabled={isLoading}
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
              disabled={isLoading}
            />
          }
        />
        <Button
          type="submit"
          disabled={disableButton || isLoading}
          sx={{ mt: 2, mb: 2 }}
          onClick={onSubmit}
        >
          {isNewUser ? 'Create account' : 'Login'}
        </Button>
        <ApiLoading isLoading={isLoading} />
        <ApiError requestObj={isNewUser ? registerRequest : loginRequest} />
      </Form>
    </div>
  )
}
