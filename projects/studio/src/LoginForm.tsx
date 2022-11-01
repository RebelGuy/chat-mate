import { LoginResponse } from '@rebel/server/controllers/AccountController'
import { isNullOrEmpty } from '@rebel/server/util/strings'
import { login } from '@rebel/studio/api'
import ApiRequestTrigger from '@rebel/studio/ApiRequestTrigger'
import { LoginContext } from '@rebel/studio/LoginProvider'
import { useContext, useState } from 'react'

type Props = {
  onBack: () => void
  onRegister: () => void
}

export default function LoginForm (props: Props) {
  const loginContext = useContext(LoginContext)
  const [username, onSetUsername] = useState('')
  const [password, onSetPassword] = useState('')

  const disableButton = isNullOrEmpty(username) || isNullOrEmpty(password)

  const onSuccess = (loginToken: string) => {
    loginContext.setLogin(username, loginToken)
    props.onBack()
  }

  return (
    <ApiRequestTrigger isAnonymous onRequest={() => onLogin(username, password, onSuccess)}>
      {(onMakeRequest, responseData, loadingNode, errorNode) => (
        <>
          {/* return false to prevent the page from refreshing */}
          <form onSubmit={() => { onMakeRequest(); return false }}>
            <input type="text" placeholder="Username" value={username} onChange={e => onSetUsername(e.target.value)} disabled={loadingNode != null} />
            <input type="password" placeholder="Password" value={password} onChange={e => onSetPassword(e.target.value)} disabled={loadingNode != null} />
            <button type="submit" disabled={disableButton || loadingNode != null} onClick={onMakeRequest}>Login</button>
            {loadingNode}
            {errorNode}
          </form>
          <button onClick={props.onRegister}>Register for an account</button>
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
