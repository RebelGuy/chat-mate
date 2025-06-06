import { LoginResponse, RegisterResponse } from '@rebel/api-models/schema/account'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { login, registerAccount } from '@rebel/studio/utility/api'
import Form from '@rebel/studio/components/Form'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { useContext, useEffect, useState } from 'react'
import { generatePath, useNavigate, useSearchParams } from 'react-router-dom'
import TextField from '@mui/material/TextField'
import { Button, Checkbox, FormControlLabel } from '@mui/material'
import AccountHelpers from '@rebel/shared/helpers/AccountHelpers'
import { InvalidUsernameError } from '@rebel/shared/util/error'
import AutoFocus from '@rebel/studio/components/Autofocus'
import useRequest, { SuccessfulResponseData } from '@rebel/studio/hooks/useRequest'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'

export const RETURN_URL_QUERY_PARAM = 'returnUrl'

const accountHelpers = new AccountHelpers()

// by combining the login/registration form into a single component, we can easily handle redirects after the user logs in/registers
export default function LoginForm () {
  const loginContext = useContext(LoginContext)
  const [username, onSetUsername] = useState('')
  const [password, onSetPassword] = useState('')
  const [confirmedPassword, onSetConfirmedPassword] = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const returnUrl = params.has(RETURN_URL_QUERY_PARAM) ? window.decodeURIComponent(params.get(RETURN_URL_QUERY_PARAM)!) : null

  const onSuccess = (data: SuccessfulResponseData<RegisterResponse | LoginResponse>) => {
    const displayName = 'displayName' in data ? data.displayName : null
    const isStreamer = 'isStreamer' in data && data.isStreamer
    loginContext.setLogin(username, displayName, data.loginToken, isStreamer)

    // redirect them to the previous page. if `replace` is true, the login page will not show up in the browser page history
    navigate(returnUrl ?? generatePath('/'), { replace: returnUrl != null })

    if ('isStreamer' in data && loginContext.streamer == null && data.isStreamer) {
      loginContext.setStreamer(username)
    }
  }

  const registerRequest = useRequest(registerAccount({ username, password }), { onDemand: true, onSuccess })
  const loginRequest = useRequest(login({ username, password }), { onDemand: true, onSuccess })

  // we don't want to show the login page if the user is already logged in
  useEffect(() => {
    if (loginContext.loginToken != null) {
      navigate(returnUrl ?? generatePath('/'), { replace: returnUrl != null })
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
  const onSubmit = isNewUser ? () => { console.log('trigger'); registerRequest.triggerRequest() } : loginRequest.triggerRequest

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
        >
          {isNewUser ? 'Create account' : 'Login'}
        </Button>
        <ApiLoading isLoading={isLoading} />
        <ApiError requestObj={isNewUser ? registerRequest : loginRequest} />
      </Form>
    </div>
  )
}
