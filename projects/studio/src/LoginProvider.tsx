import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { authenticate, getRanks, getStreamers } from '@rebel/studio/api'
import * as React from 'react'

export type RankName = PublicRank['name']

type Props = {
  children: React.ReactNode
}

export default function LoginProvider (props: Props) {
  const [loginToken, setLoginToken] = React.useState<string | null>(null)
  const [username, setUsername] = React.useState<string | null>(null)
  const [streamer, setStreamer] = React.useState<string | null>(null)
  const [initialised, setInitialised] = React.useState(false)
  const [ranks, setRanks] = React.useState<RankName[]>([])
  const [allStreamers, setAllStreamers] = React.useState<string[]>([])

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
      return
    }
    
    const hydrateStreamers = async () => {
      const response = await getStreamers(loginToken)
      if (response.success) {
        setAllStreamers(response.data.streamers)
      }
    }
    hydrateStreamers()
  }, [loginToken])

  React.useEffect(() => {
    if (loginToken == null) {
      setRanks([])
      return
    }

    const loadRanks = async () => {
      const result = await getRanks(loginToken, streamer ?? undefined)
      
      if (result.success) {
        setRanks(result.data.ranks.map(r => r.rank.name))
      }
    }
    loadRanks()
  }, [loginToken, streamer])

  return (
    <LoginContext.Provider
      value={{
        initialised,
        loginToken,
        username,
        streamer,
        allStreamers,
        isStreamer: allStreamers.includes(username ?? ''),
        setLogin: onSetLogin,
        login: onLogin,
        setStreamer: onSetStreamer,
        logout: onClearAuthInfo,
        hasRank: rankName => ranks.find(r => r === rankName) != null,
      }}
    >
      {props.children}
    </LoginContext.Provider>
  )
}

type LoginContextType = {
  initialised: boolean
  loginToken: string | null

  /** Is streamer anywhere, regardless of the current streamer context. */
  isStreamer: boolean
  allStreamers: string[]

  /** The streamer context. */
  streamer: string | null
  username: string | null

  /** Logs the user in using the saved credentials, if any. Returns true if the login was successful. */
  login: () => Promise<boolean>
  setLogin: (username: string, token: string) => void
  setStreamer: (streamer: string | null) => void
  logout: () => void
  hasRank: (rankName: RankName) => boolean
}

export const LoginContext = React.createContext<LoginContextType>(null!)
