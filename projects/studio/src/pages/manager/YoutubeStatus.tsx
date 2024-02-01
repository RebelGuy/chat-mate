import { Alert, Box, Button } from '@mui/material'
import { GetPrimaryChannelsResponse } from '@rebel/api-models/schema/streamer'
import { ApiResponseData } from '@rebel/api-models/types'
import { getChannelUrlFromPublic } from '@rebel/shared/util/channel'
import ApiError from '@rebel/studio/components/ApiError'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import RelativeTime from '@rebel/studio/components/RelativeTime'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import useRequest, { onConfirmRequest } from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { getYoutubeStatus, getChatMateRegisteredUsername, revokeYoutubeStreamer, authoriseYoutubeStreamer, getYoutubeStreamerLoginUrl, getYoutubeModerators, getStatus } from '@rebel/studio/utility/api'
import { getAuthTypeFromParams } from '@rebel/studio/utility/misc'
import { useContext, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

type Props = {
  primaryYoutubeChannelName: string
}

export default function YoutubeStatus (props: Props) {
  const [params, setParams] = useSearchParams()

  // params are cleared upon mounting, but retained in state by setting them as the default value of each piece of state.
  const [isYoutubeAuth] = useState(getAuthTypeFromParams(params) === 'youtube')
  const code = isYoutubeAuth ? params.get('code') : null
  const [hasCode] = useState(code != null)

  const loginContext = useContext(LoginContext)
  const [refreshToken, updateRefreshToken] = useUpdateKey()
  const getYoutubeStatusRequest = useRequest(getYoutubeStatus(), { updateKey: refreshToken })
  const getChatMateRegisteredUsernameRequest = useRequest(getChatMateRegisteredUsername(), { updateKey: refreshToken })
  const getYoutubeStreamerLoginUrlRequest = useRequest(getYoutubeStreamerLoginUrl())
  const authoriseYoutubeStreamerRequest = useRequest(authoriseYoutubeStreamer(code!), { onDemand: true })
  const revokeAccessRequest = useRequest(revokeYoutubeStreamer(), {
    onDemand: true,
    onRequest: () => onConfirmRequest('Are you sure you wish to revoke ChatMate access to your YouTube channel?'),
  })
  const getYoutubeModeratorsRequest = useRequest(getYoutubeModerators(), { updateKey: refreshToken })
  const getStatusRequest = useRequest(getStatus(), { updateKey: refreshToken })
  const [isLivestreamActive, setIsLivestreamActive] = useState(getStatusRequest.data?.livestreamStatus != null)

  const chatMateInfo = loginContext.allStreamers.find(streamer => streamer.username === getChatMateRegisteredUsernameRequest.data?.username)
  const requiresAuth = getYoutubeStatusRequest.data == null || !getYoutubeStatusRequest.data.chatMateIsAuthorised

  const chatMateChannelId = chatMateInfo?.youtubeChannel?.channelId
  const isDefinitelyModerator = chatMateChannelId != null && getYoutubeModeratorsRequest.data?.moderators.some(mod => mod.channelId === chatMateChannelId)

  const onLoginToYoutube = () => {
    window.location.href = getYoutubeStreamerLoginUrlRequest.data!.url
  }

  useEffect(() => {
    if (isYoutubeAuth) {
      setParams({})
    }

    if (code != null) {
      authoriseYoutubeStreamerRequest.triggerRequest()
        .then(updateRefreshToken) // this ensures we retry the moderator list request
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // if the user hasn't set an active livestream, we don't get the list of moderators because
  // the request on the server would fail. if the user then sets the livestream, we need to trigger
  // a request to get the list of moderators.
  useEffect(() => {
    const isLivestreamActiveCurrent = getStatusRequest.data?.livestreamStatus != null
    if (isLivestreamActiveCurrent && !isLivestreamActive && !getYoutubeModeratorsRequest.isLoading) {
      getYoutubeModeratorsRequest.triggerRequest()
    }

    setIsLivestreamActive(isLivestreamActiveCurrent)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getStatusRequest.data])

  return <>
    <PanelHeader>YouTube Status {<RefreshButton isLoading={getYoutubeStatusRequest.isLoading && getYoutubeModeratorsRequest.isLoading} onRefresh={updateRefreshToken} />}</PanelHeader>

    <Box>
      {requiresAuth ?
        <Box>
          You need to grant ChatMate access to your YouTube channel.
          This will be used to perform moderator actions. Please use your YouTube channel {<b>{props.primaryYoutubeChannelName}</b>} to provide access.
        </Box>
        :
        <Box>
          Looks like you have granted ChatMate access to your YouTube channel for performing moderator actions.
          If you still want to refresh authorisation for the channel {<b>{props.primaryYoutubeChannelName}</b>}, you can do so using the below button.
        </Box>
      }

      {hasCode &&
        <>
          {authoriseYoutubeStreamerRequest.data != null &&
            <Alert sx={{ mt: 1 }} severity="success">
              Successfully authorised ChatMate.
            </Alert>
          }
          <ApiLoading requestObj={authoriseYoutubeStreamerRequest}>Checking authorisation. Please wait...</ApiLoading>
          <ApiError requestObj={authoriseYoutubeStreamerRequest} hideRetryButton />
        </>
      }

      {(!hasCode || authoriseYoutubeStreamerRequest.error != null) &&
        <Button
          onClick={onLoginToYoutube}
          disabled={getYoutubeStreamerLoginUrlRequest.data == null}
          sx={{ mt: 1, mr: 1 }}
        >
          Authorise access
        </Button>
      }

      <Button
        onClick={() => revokeAccessRequest.triggerRequest()}
        disabled={revokeAccessRequest.isLoading || revokeAccessRequest.data != null}
        sx={{ mt: 1 }}
      >
        Revoke access
      </Button>
      <ApiLoading requestObj={revokeAccessRequest} />
      <ApiError requestObj={revokeAccessRequest} hideRetryButton />
    </Box>

    <Box sx={{ mt: 4 }}>
      In order to benefit from all features, ChatMate requires that you add the&nbsp;
      <LinkInNewTab href={chatMateInfo != null ? getChannelUrlFromPublic(chatMateInfo.youtubeChannel!) : ''}><b>{chatMateInfo?.youtubeChannel!.displayName ?? 'ChatMate'}</b></LinkInNewTab>
      &nbsp;YouTube channel to the standard moderator list (
      <LinkInNewTab href="https://studio.youtube.com/">YouTube Studio</LinkInNewTab>
      &nbsp;-&gt; Settings -&gt; Community). For example, this will allow ChatMate to listen for punishments applied on YouTube, and synchronise these punishments on other accounts/platforms.
    </Box>

    <ApiLoading requestObj={[getYoutubeStatusRequest, getChatMateRegisteredUsernameRequest, getYoutubeModeratorsRequest, getStatusRequest]} initialOnly />
    <ApiError requestObj={[getYoutubeStatusRequest, getChatMateRegisteredUsernameRequest, getStatusRequest]} /> {/* deliberately don't show the moderator request, as it would show an error if ChatMate is not yet authorised */}

    {getYoutubeStatusRequest.data != null && getChatMateRegisteredUsernameRequest.data != null && (getYoutubeModeratorsRequest.data != null || getYoutubeModeratorsRequest.error != null) && getStatusRequest.data != null && <>
      {getYoutubeModeratorsRequest.data != null ? // in this case, we know definitely whether ChatMate is a moderator or not. technically this never comes up if we are not a moderator, because then we can't make the request
        <Box sx={{ mt: 1, mb: 1 }}>
          ChatMate is
          <Box display="inline" sx={{ color: isDefinitelyModerator ? 'green' : 'red' }}>{isDefinitelyModerator ? '' : ' not'} added as a moderator </Box>
          to your channel.
        </Box>
        : // otherwise, we must make an educated guess (this can come up if the user has not authorised ChatMate)
        <>
          <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
            {getStatusRequest.data?.livestreamStatus != null ? <>
              {/* show detailed information - the user can't fix this */}
              Due to limitations with the current YouTube API that ChatMate is using, we are only able to
              check the moderator status at the time of the last received chat message in your latest livestream
              that was sent by a non-moderator user.
              The below status may be outdated and should be used as a guide only.
            </> : <>
              {/* we can get more reliable results if the user sets an active livestream. this allows us to make a request to the Youtube API */}
              The below status may be outdated. Please ensure you have an active livestream set.</>}
          </Alert>
          <Box>
            ChatMate is
            <Box display="inline" sx={{ color: getYoutubeStatusRequest.data.chatMateIsModerator ? 'green' : 'red' }}>{getYoutubeStatusRequest.data.chatMateIsModerator ? '' : ' not'} added as a moderator </Box>
            to your channel
            <Box display="inline" color="grey"> (as of {<RelativeTime time={getYoutubeStatusRequest.data.timestamp} />} ago)</Box>.
          </Box>
        </>}
    </>}
  </>
}
