import { authenticate } from '@rebel/studio/api'
import * as React from 'react'

type Props = {
  children: React.ReactNode
}

export default function LoginProvider (props: Props) {
  const [loginToken, setLoginToken] = React.useState<string | null>(null)
  const [username, setUsername] = React.useState<string | null>(null)

  function onSetLogin (username: string, token: string) {
    try {
      window.localStorage.setItem('loginToken', token)
    } catch (e: any) {
      console.error('Unable to save login token to local storage:', e)
    }

    setLoginToken(token)
    setUsername(username)
  }

  function onClearAuthInfo () {
    try {
      window.localStorage.removeItem('loginToken')
    } catch (e: any) {
      console.error('Unable to remove login token from local storage:', e)
    }

    setLoginToken(null)
    setUsername(null)
  }

  // componentDidMount equivalent
  // authenticate the saved token, if any exists
  React.useEffect(() => {
    const getToken = async () => {
      let loginToken: string | null = null
      try {
        loginToken = window.localStorage.getItem('loginToken')
        
        if (loginToken != null) {
          const response = await authenticate(loginToken)

          if (response.success) {
            setUsername(response.data.username)
          } else if (response.error.errorCode === 401) {
            console.log('Stored login token was invalid. The user must log in.')
            loginToken = null
            onClearAuthInfo()
          }
        }
      } catch (e: any) {
        console.error('Unable to initialise login:', e)
      }

      setLoginToken(loginToken)
    }
    getToken()
  }, [])

  return (
    <LoginContext.Provider
      value={{
        loginToken,
        username,
        setLogin: onSetLogin,
        logout: onClearAuthInfo
      }}
    >
      {props.children}
    </LoginContext.Provider>
  )
}

type LoginContextType = {
  loginToken: string | null
  username: string | null
  setLogin: (username: string, token: string) => void
  logout: () => void
}

export const LoginContext = React.createContext<LoginContextType>(null!)
