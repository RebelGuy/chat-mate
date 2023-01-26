import { isNullOrEmpty } from '@rebel/server/util/strings'
import { authenticate, getGlobalRanks } from '@rebel/studio/api'
import * as React from 'react'

type Props = {
  children: React.ReactNode
}

export default function LoginProvider (props: Props) {
  const [loginToken, setLoginToken] = React.useState<string | null>(null)
  const [username, setUsername] = React.useState<string | null>(null)
  const [streamer, setStreamer] = React.useState<string | null>(null)
  const [initialised, setInitialised] = React.useState(false)
  const [isAdmin, setIsAdmin] = React.useState(false)

  function onSetLogin (username: string, token: string) {
    try {
      window.localStorage.setItem('loginToken', token)
    } catch (e: any) {
      console.error('Unable to save login token to local storage:', e)
    }

    setLoginToken(token)
    setUsername(username)
  }

  function onSetStreamer (streamer: string | null) {
    if (isNullOrEmpty(streamer)) {
      streamer = null
    }

    try {
      if (streamer == null) {
        window.localStorage.removeItem('streamer')
      } else {
        window.localStorage.setItem('streamer', streamer)
      }
    } catch (e: any) {
      console.error('Unable to save streamer to local storage:', e)
    }

    setStreamer(streamer)
  }

  function onClearAuthInfo () {
    try {
      window.localStorage.removeItem('loginToken')
      window.localStorage.removeItem('streamer')
    } catch (e: any) {
      console.error('Unable to remove login token from local storage:', e)
    }

    setLoginToken(null)
    setUsername(null)
    setStreamer(null)
  }

  const onLogin = React.useCallback(async (): Promise<boolean> => {
    try {
      const loginToken = window.localStorage.getItem('loginToken')
      if (loginToken == null) {
        return false
      }

      const response = await authenticate(loginToken)

      if (response.success) {
        setLoginToken(loginToken)
        setUsername(response.data.username)

        if (response.data.isStreamer && streamer == null) {
          onSetStreamer(response.data.username)
        }
        return true
      } else if (response.error.errorCode === 401) {
        console.log('Stored login token was invalid. The user must log in.')
        onClearAuthInfo()
      }
    } catch (e: any) {
      console.error('Unable to login:', e)
    }

    return false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // componentDidMount equivalent
  // authenticate the saved token, if any exists
  React.useEffect(() => {
    const loadContext = async () => {
      await onLogin()

      let streamer: string | null = null
      try {
        streamer = window.localStorage.getItem('streamer')
      } catch (e: any) {
        console.error('Unable to initialise streamer:', e)
      }

      setStreamer(streamer)
      setInitialised(true)
    }
    loadContext()
  }, [onLogin])

  React.useEffect(() => {
    if (loginToken == null) {
      setIsAdmin(false)
      return
    }

    const loadRanks = async () => {
      const result = await getGlobalRanks(loginToken)
      
      if (result.success) {
        setIsAdmin(result.data.ranks.find(r => r.rank.name === 'admin') != null)
      }
    }
    loadRanks()
  }, [loginToken])

  return (
    <LoginContext.Provider
      value={{
        initialised,
        loginToken,
        username,
        streamer,
        isAdmin: username === 'admin' || isAdmin,
        setLogin: onSetLogin,
        login: onLogin,
        setStreamer: onSetStreamer,
        logout: onClearAuthInfo
      }}
    >
      {props.children}
    </LoginContext.Provider>
  )
}

type LoginContextType = {
  initialised: boolean
  loginToken: string | null

  /** The streamer context. */
  streamer: string | null
  username: string | null
  isAdmin: boolean

  /** Logs the user in using the saved credentials, if any. Returns true if the login was successful. */
  login: () => Promise<boolean>
  setLogin: (username: string, token: string) => void
  setStreamer: (streamer: string | null) => void
  logout: () => void
}

export const LoginContext = React.createContext<LoginContextType>(null!)
