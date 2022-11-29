import { RegisterResponse } from '@rebel/server/controllers/AccountController'
import { isNullOrEmpty } from '@rebel/server/util/strings'
import { registerAccount } from '@rebel/studio/api'
import ApiRequestTrigger from '@rebel/studio/ApiRequestTrigger'
import { LoginContext } from '@rebel/studio/LoginProvider'
import { useContext, useState } from 'react'

type Props = {
  onBack: () => void
}

export default function RegistrationForm (props: Props) {
  const [username, onSetUsername] = useState('')
  const [password, onSetPassword] = useState('')
  const [confirmedPassword, onSetConfirmedPassword] = useState('')
  const loginContext = useContext(LoginContext)

  const disableButton = isNullOrEmpty(username) || isNullOrEmpty(password) || password !== confirmedPassword

  const onSuccess = (loginToken: string) => {
    loginContext.setLogin(username, loginToken)
    props.onBack()
  }

  return (
    <ApiRequestTrigger isAnonymous onRequest={() => onRegisterAccount(username, password, onSuccess)}>
      {(onMakeRequest, responseData, loadingNode, errorNode) => (
        <form onSubmit={() => { onMakeRequest(); return false }}>
          <input type="text" placeholder="Username" value={username} onChange={e => onSetUsername(e.target.value)} disabled={loadingNode != null} />
          <input type="password" placeholder="Password" value={password} onChange={e => onSetPassword(e.target.value)} disabled={loadingNode != null} />
          <input type="password" placeholder="Confirm Password" value={confirmedPassword} onChange={e => onSetConfirmedPassword(e.target.value)} disabled={loadingNode != null} />
          <button type="submit" disabled={disableButton || loadingNode != null} onClick={onMakeRequest}>Register</button>
          {loadingNode}
          {errorNode}
        </form>
      )}
    </ApiRequestTrigger>
  )
}

async function onRegisterAccount (username: string, password: string, onSuccess: (loginToken: string) => void): Promise<RegisterResponse> {
  const result = await registerAccount(username, password)

  if (result.success) {
    onSuccess(result.data.loginToken)
  }

  return result
}
