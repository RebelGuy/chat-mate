import { ApiError } from '@rebel/server/controllers/ControllerBase'
import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import { PublicUser } from '@rebel/server/controllers/public/user/PublicUser'
import { nonNull } from '@rebel/shared/util/arrays'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { routeParams } from '@rebel/studio/components/RouteParamsObserver'
import useRequest, { ApiRequestError } from '@rebel/studio/hooks/useRequest'
import { authenticate, getGlobalRanks, getRanksForStreamer, getStreamers, getUser } from '@rebel/studio/utility/api'
import * as React from 'react'

export type RankName = PublicRank['name']

type Props = {
  children: React.ReactNode
}

export function LoginProvider (props: Props) {
  const [loginToken, setLoginToken] = React.useState<string | null>(null)
  const [username, setUsername] = React.useState<string | null>(null)
  const [isStreamer, setIsStreamer] = React.useState(false)
  const [loadingCount, setLoadingCount] = React.useState(0)
  const [selectedStreamer, setSelectedStreamer] = React.useState<string | null>(null)

  const getGlobalRanksRequest = useRequest(getGlobalRanks(), {
    onDemand: true,
    loginToken: loginToken,
    onError: console.log
  })
  const getRanksForStreamerRequest = useRequest(getRanksForStreamer(), {
    onDemand: true,
    loginToken: loginToken,
    streamer: selectedStreamer,
    onError: console.log
  })
  const getUserRequest = useRequest(getUser(), {
    onDemand: true,
    loginToken: loginToken,
    streamer: selectedStreamer,
    onError: console.log
  })
  const getStreamersRequest = useRequest(getStreamers(), {
    onDemand: true,
    loginToken: loginToken,
    onError: console.log
  })

  function onSetLogin (usernameToSet: string, token: string, isStreamerToSet: boolean) {
    try {
      window.localStorage.setItem('loginToken', token)
    } catch (e: any) {
      console.error('Unable to save login token to local storage:', e)
    }

    setLoginToken(token)
    setUsername(usernameToSet)
    setIsStreamer(isStreamerToSet)
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
    setIsStreamer(false)
    setSelectedStreamer(null)
  }

  const onLogin = React.useCallback(async () => {
    try {
      const storedStreamer = window.localStorage.getItem('streamer')
      const storedLoginToken = window.localStorage.getItem('loginToken')
      if (storedLoginToken == null) {
        return
      }

      setLoadingCount(c => c + 1)
      const response = await authenticate(storedLoginToken)
        .finally(() => setLoadingCount(c => c - 1))

      if (response.success) {
        setLoginToken(storedLoginToken)
        setUsername(response.data.username)
        setIsStreamer(response.data.isStreamer)

        if (response.data.isStreamer && storedStreamer == null) {
          onPersistStreamer(response.data.username)
        }

        return
      } else if (response.error.errorCode === 401) {
        console.log('Stored login token was invalid. The user must log in.')
        onClearAuthInfo()
      }
    } catch (e: any) {
      console.error('Unable to login:', e)
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    }
    void loadContext()
  }, [onLogin])

  React.useEffect(() => {
    if (loginToken == null) {
      getGlobalRanksRequest.reset()
      getStreamersRequest.reset()
      getRanksForStreamerRequest.reset()
      getUserRequest.reset()
      return
    }

    // always load global ranks, and use them as a fallback if we don't have a streamer selected
    // (streamer ranks include global ranks)
    getGlobalRanksRequest.triggerRequest()
    getStreamersRequest.triggerRequest()

    // this ensures we don't end up being un-hydrated if not selecting a streamer
    if (selectedStreamer == null) {
      getRanksForStreamerRequest.reset({ ranks: [] })
      getUserRequest.reset(undefined, { errorCode: 500, errorType: 'Unknown', message: 'No data' })
      return
    }

    getRanksForStreamerRequest.triggerRequest()
    getUserRequest.triggerRequest()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginToken, selectedStreamer])

  const requests = [getUserRequest, getGlobalRanksRequest, getRanksForStreamerRequest, getStreamersRequest]
  const isHydrated = requests.find(r => r.data == null && r.error == null) == null
  const isLoading = requests.find(r => r.isLoading) != null
  const errors = nonNull(requests.map(r => r.error))
  const ranks = [...(getGlobalRanksRequest.data?.ranks ?? []), ...(getRanksForStreamerRequest.data?.ranks ?? [])]

  return (
    <LoginContext.Provider
      value={{
        isHydrated,
        loginToken,
        username,
        user: getUserRequest.data?.user ?? null,
        isLoading: loadingCount > 0 || isLoading,
        errors: errors.length === 0 ? null : errors,
        streamer: selectedStreamer,
        allStreamers: getStreamersRequest.data?.streamers ?? [],
        isStreamer: isStreamer,
        setLogin: onSetLogin,
        setStreamer: onPersistStreamer,
        logout: onClearAuthInfo,
        hasRank: rankName => ranks.find(r => r.rank.name === rankName) != null
      }}
    >
      {props.children}
    </LoginContext.Provider>
  )
}

export type LoginContextType = {
  isHydrated: boolean
  loginToken: string | null

  /** Is streamer anywhere, regardless of the current streamer context. */
  isStreamer: boolean
  allStreamers: string[]

  /** The streamer context. */
  streamer: string | null
  username: string | null
  user: PublicUser | null
  isLoading: boolean
  errors: ApiRequestError[] | null

  setLogin: (username: string, token: string, isStreamer: boolean) => void
  setStreamer: (streamer: string | null) => void
  logout: () => void
  hasRank: (rankName: RankName) => boolean
}

const LoginContext = React.createContext<LoginContextType>(null!)
export default LoginContext
