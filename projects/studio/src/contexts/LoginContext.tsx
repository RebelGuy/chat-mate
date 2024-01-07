import { PublicRank } from '@rebel/api-models/public/rank/PublicRank'
import { PublicUserRank } from '@rebel/api-models/public/rank/PublicUserRank'
import { PublicStreamerSummary } from '@rebel/api-models/public/streamer/PublicStreamerSummary'
import { PublicUser } from '@rebel/api-models/public/user/PublicUser'
import { nonNull, unique } from '@rebel/shared/util/arrays'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import { routeParams } from '@rebel/studio/components/RouteParamsObserver'
import useRequest, { ApiRequestError } from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { authenticate, getCustomisableRankNames, getGlobalRanks, getRanksForStreamer, getStreamers, getUser } from '@rebel/studio/utility/api'
import * as React from 'react'

export type RankName = PublicRank['name']

export type RefreshableDataType = 'streamerList' | 'userRanks'

type Props = {
  children: React.ReactNode
}

export function LoginProvider (props: Props) {
  const [loginToken, setLoginToken] = React.useState<string | null>(null)
  const [username, setUsername] = React.useState<string | null>(null)
  const [isStreamer, setIsStreamer] = React.useState(false)
  const [hasLoadedAuth, setHasLoadedAuth] = React.useState(false)
  const [selectedStreamer, setSelectedStreamer] = React.useState<string | null>(null)
  const [authError, setAuthError] = React.useState<string | null>(null)

  const [streamerListUpdateKey, incrementStreamerListUpdateKey] = useUpdateKey({ repeatInterval: 60_000 })
  const [customisableRankNamesUpdateKey] = useUpdateKey({ repeatInterval: 60_000 })

  const getGlobalRanksRequest = useRequest(getGlobalRanks(), {
    onDemand: true,
    loginToken: loginToken,
    onError: (error, type) => console.error(error)
  })
  const getRanksForStreamerRequest = useRequest(getRanksForStreamer(), {
    onDemand: true,
    loginToken: loginToken,
    streamer: selectedStreamer,
    onError: (error, type) => console.error(error)
  })
  const getUserRequest = useRequest(getUser(), {
    onDemand: true,
    loginToken: loginToken,
    streamer: selectedStreamer,
    onError: (error, type) => console.error(error)
  })
  const getStreamersRequest = useRequest(getStreamers(), {
    updateKey: streamerListUpdateKey,
    skipLoadOnMount: true,
    loginToken: loginToken,
    onError: (error, type) => console.error(error)
  })
  const getCustomisableRankNamesRequest = useRequest(getCustomisableRankNames(), {
    updateKey: customisableRankNamesUpdateKey,
    skipLoadOnMount: true,
    loginToken: loginToken,
    onRequest: () => username == null,
    onError: (error, type) => console.error(error)
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
    setAuthError(null)
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
    } catch (e: any) {
      console.error('Unable to remove login token from local storage:', e)
    }

    setLoginToken(null)
    setUsername(null)
    setIsStreamer(false)
  }

  const onLogin = React.useCallback(async () => {
    try {
      const storedStreamer = window.localStorage.getItem('streamer')
      const storedLoginToken = window.localStorage.getItem('loginToken')
      if (storedLoginToken == null) {
        setHasLoadedAuth(true)
        return
      }

      setAuthError(null)
      const response = await authenticate(storedLoginToken)
        // ugly hack: once authentication has completed, it will trigger the side effect of hydrating everything else.
        // however, this doesn't happen instantly and there are a few frames where we are logged in and not loading, causing the current page to possibly mount.
        // once we finished loading, the page will be re-mounted.
        // to avoid this interruption of the loading state, delay the time before we claim to have finished loading the authentication.
        .finally(() => window.setTimeout(() => setHasLoadedAuth(true), 50))

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
      setAuthError(e.message)
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshData = async (dataType: RefreshableDataType): Promise<boolean> => {
    if (dataType === 'streamerList') {
      const result = await getStreamersRequest.triggerRequest()
      return result.type === 'success'
    } else if (dataType === 'userRanks') {
      const results = await Promise.all([
        getGlobalRanksRequest.triggerRequest(),
        getRanksForStreamerRequest.triggerRequest()
      ])
      return results.find(r => r.type !== 'success') == null
    } else {
      assertUnreachable(dataType)
    }
  }

  // componentDidMount equivalent
  // authenticate the saved token, if any exists
  React.useEffect(() => {
    const loadContext = async () => {
      getStreamersRequest.triggerRequest()
      getCustomisableRankNamesRequest.triggerRequest()
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (loginToken == null) {
      getGlobalRanksRequest.reset()
      getRanksForStreamerRequest.reset()
      getUserRequest.reset()
      return
    }

    // always load global ranks, and use them as a fallback if we don't have a streamer selected
    // (streamer ranks include global ranks)
    getGlobalRanksRequest.triggerRequest()

    // this ensures we don't end up being un-hydrated if not selecting a streamer
    if (selectedStreamer == null) {
      getRanksForStreamerRequest.reset({ ranks: [] })
      getUserRequest.reset(undefined, { errorCode: 500, errorType: 'Unknown', internalErrorType: 'Unknown', message: 'No data' })
      return
    }

    getRanksForStreamerRequest.triggerRequest()
    getUserRequest.triggerRequest()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginToken, selectedStreamer])

  const requests = username == null ? [getStreamersRequest] : [getUserRequest, getGlobalRanksRequest, getRanksForStreamerRequest, getStreamersRequest, getCustomisableRankNamesRequest]
  const isHydrated = requests.find(r => r.data == null && r.error == null) == null
  const isLoading = requests.find(r => r.isLoading) != null
  const errors = nonNull(requests.map(r => r.error))
  const ranks = unique([...(getGlobalRanksRequest.data?.ranks ?? []), ...(getRanksForStreamerRequest.data?.ranks ?? [])], r => r.id)

  return (
    <LoginContext.Provider
      value={{
        isHydrated,
        loginToken,
        username,
        user: getUserRequest.data?.user ?? null,
        isLoading: !hasLoadedAuth || isLoading,
        loadingData: nonNull([getStreamersRequest.isLoading ? 'streamerList' : null]),
        errors: errors.length === 0 ? null : errors,
        streamer: selectedStreamer,
        allStreamers: getStreamersRequest.data?.streamers ?? [],
        isStreamer: isStreamer,
        authError: authError,
        allRanks: ranks,
        customisableRanks: getCustomisableRankNamesRequest.data?.customisableRanks?.map(r => r.name) ?? [],
        setLogin: onSetLogin,
        setStreamer: onPersistStreamer,
        logout: onClearAuthInfo,
        hasRank: rankName => ranks.find(r => r.rank.name === rankName) != null,
        refreshData: refreshData
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
  allStreamers: PublicStreamerSummary[]

  /** The streamer context. */
  streamer: string | null
  username: string | null
  user: PublicUser | null
  isLoading: boolean
  loadingData: RefreshableDataType[]
  errors: ApiRequestError[] | null
  authError: string | null
  allRanks: PublicUserRank[]
  customisableRanks: RankName[]

  setLogin: (username: string, token: string, isStreamer: boolean) => void
  setStreamer: (streamer: string | null) => void
  logout: () => void
  hasRank: (rankName: RankName) => boolean

  // resolves to true if the refresh succeeded
  refreshData: (dataType: RefreshableDataType) => Promise<boolean>
}

const LoginContext = React.createContext<LoginContextType>(null!)
export default LoginContext
