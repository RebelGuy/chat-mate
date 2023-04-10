import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { routeParams } from '@rebel/studio/components/RouteParamsObserver'
import useRequest from '@rebel/studio/hooks/useRequest'
import { authenticate, getRanks, getStreamers, getUser } from '@rebel/studio/utility/api'
import * as React from 'react'

export type RankName = PublicRank['name']

type Props = {
  children: React.ReactNode
}

export function LoginProvider (props: Props) {
  const [loginToken, setLoginToken] = React.useState<string | null>(null)
  const [username, setUsername] = React.useState<string | null>(null)
  const [loadingCount, setLoadingCount] = React.useState(0)
  const [selectedStreamer, setSelectedStreamer] = React.useState<string | null>(null)
  const [initialised, setInitialised] = React.useState(false)
  const [ranks, setRanks] = React.useState<RankName[]>([])
  const [allStreamers, setAllStreamers] = React.useState<string[]>([])
  const getUserRequest = useRequest(getUser(), {
    onDemand: true,
    loginToken: loginToken,
    streamer: selectedStreamer,
    onError: console.log
  })

  function onSetLogin (usernameToSet: string, token: string) {
    try {
      window.localStorage.setItem('loginToken', token)
    } catch (e: any) {
      console.error('Unable to save login token to local storage:', e)
    }

    setLoginToken(token)
    setUsername(usernameToSet)
    void onHydrateStreamers(token)
  }

  function onPersistStreamer (streamer: string | null) {
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

    setSelectedStreamer(streamer)
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
    setSelectedStreamer(null)
    setRanks([])
  }

  const onLogin = React.useCallback(async (): Promise<boolean> => {
    try {
      const storedStreamer = window.localStorage.getItem('streamer')
      const storedLoginToken = window.localStorage.getItem('loginToken')
      if (storedLoginToken == null) {
        return false
      }

      setLoadingCount(c => c + 1)
      const response = await authenticate(storedLoginToken)
        .finally(() => setLoadingCount(c => c - 1))

      if (response.success) {
        setLoginToken(storedLoginToken)
        setUsername(response.data.username)

        if (response.data.isStreamer && storedStreamer == null) {
          onPersistStreamer(response.data.username)
        }

        await onHydrateStreamers(storedLoginToken)
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

  const onHydrateStreamers = async (login: string) => {
    if (login == null) {
      return
    }

    setLoadingCount(c => c + 1)
    const response = await getStreamers(login)
      .finally(() => setLoadingCount(c => c - 1))

    if (response.success) {
      setAllStreamers(response.data.streamers)
    }
  }

  // componentDidMount equivalent
  // authenticate the saved token, if any exists
  React.useEffect(() => {
    const loadContext = async () => {
      await onLogin()

      let streamer: string | null = null
      if (routeParams.streamer != null) {
        // override the stored streamer if the streamer selection is made within the URL.
        // this happens only on initial page load - any other streamer modifications must
        // be made by calling `loginContext.setStreamer`.

        // note that, since we are not a child of the <Route /> component, we won't have
        // access to the `useParams` hook. to work around that, we grab the current params
        // from the `<RouteParamsObserver />` component which _is_ a child of the <Route />
        // component.
        streamer = routeParams.streamer
      } else {
        try {
          streamer = window.localStorage.getItem('streamer')
        } catch (e: any) {
          console.error('Unable to initialise streamer:', e)
        }
      }

      onPersistStreamer(streamer)
      setInitialised(true)
    }
    void loadContext()
  }, [onLogin])

  React.useEffect(() => {
    if (loginToken == null) {
      setRanks([])
      getUserRequest.reset()
      return
    }

    getUserRequest.triggerRequest()

    const loadRanks = async () => {
      setLoadingCount(c => c + 1)
      const result = await getRanks(loginToken, selectedStreamer ?? undefined)
        .finally(() => setLoadingCount(c => c - 1))

      if (result.success) {
        setRanks(result.data.ranks.map(r => r.rank.name))
      }
    }
    void loadRanks()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginToken, selectedStreamer])

  return (
    <LoginContext.Provider
      value={{
        initialised,
        loginToken,
        username,
        user: getUserRequest.data?.user ?? null,
        isLoading: loadingCount > 0 || getUserRequest.isLoading || getUserRequest == null,
        streamer: selectedStreamer,
        allStreamers,
        isStreamer: allStreamers.includes(username ?? ''),
        setLogin: onSetLogin,
        login: onLogin,
        setStreamer: onPersistStreamer,
        logout: onClearAuthInfo,
        hasRank: rankName => ranks.find(r => r === rankName) != null,
      }}
    >
      {props.children}
    </LoginContext.Provider>
  )
}

export type LoginContextType = {
  initialised: boolean
  loginToken: string | null

  /** Is streamer anywhere, regardless of the current streamer context. */
  isStreamer: boolean
  allStreamers: string[]

  /** The streamer context. */
  streamer: string | null
  username: string | null
  user: PublicUser | null
  isLoading: boolean

  /** Logs the user in using the saved credentials, if any. Returns true if the login was successful. */
  login: () => Promise<boolean>
  setLogin: (username: string, token: string) => void
  setStreamer: (streamer: string | null) => void
  logout: () => void
  hasRank: (rankName: RankName) => boolean
}

const LoginContext = React.createContext<LoginContextType>(null!)
export default LoginContext
