import AdminLink from '@rebel/studio/pages/link/AdminLink'
import { addLinkedChannel, getLinkedChannels, getOfficialChatMateStreamer, getPrimaryChannels, getTwitchLoginUrl, getYoutubeLoginUrl, linkTwitchChannel, linkYoutubeChannel } from '@rebel/studio/utility/api'
import RequireRank from '@rebel/studio/components/RequireRank'
import LinkedChannels from '@rebel/studio/pages/link/LinkedChannels'
import { LinkHistory } from '@rebel/studio/pages/link/LinkHistory'
import { MAX_CHANNEL_LINKS_ALLOWED } from '@rebel/shared/constants'
import { Alert, Button, Link, TextField, Typography } from '@mui/material'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { CreateLinkToken } from '@rebel/studio/pages/link/CreateLinkToken'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import useRequest, { onConfirmRequest } from '@rebel/studio/hooks/useRequest'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'
import StreamerLinks from '@rebel/studio/components/StreamerLinks'
import LinkAttemptLogs from '@rebel/studio/pages/link/LinkAttemptLogs'
import { useSearchParams } from 'react-router-dom'
import { getAuthTypeFromParams } from '@rebel/studio/utility/misc'
import { useContext, useEffect, useState } from 'react'

export const LEGACY_VIEW_QUERY_PARAM = 'legacyView'

// props are the user details of the currently selected user in the admin context. changed by searching for another user
export default function LinkUser (props: { admin_selectedAggregateUserId?: number, admin_selectedDefaultUserId?: number }) {
  const loginContext = useContext(LoginContext)
  const [key, updateKey] = useUpdateKey()
  const [params, setParams] = useSearchParams()

  // the user to link to
  const [selectedAggregateUserId, setSelectedAggregateUserId] = useState<number | null>()

  const getLinkedChannelsRequest = useRequest(getLinkedChannels(props.admin_selectedAggregateUserId), { updateKey: key })
  const getPrimaryChannelsRequest = useRequest(getPrimaryChannels(), { updateKey: key, blockAutoRequest: !loginContext.isStreamer })
  const getOfficialChatMateStreamerRequest = useRequest(getOfficialChatMateStreamer())

  const legacyView = params.get(LEGACY_VIEW_QUERY_PARAM) === 'true'

  // when the user authenticated ChatMate to link their channel
  const [isYoutubeAuth] = useState(getAuthTypeFromParams(params) === 'youtube')
  const [isTwitchAuth] = useState(getAuthTypeFromParams(params) === 'twitch')
  const code = isYoutubeAuth || isTwitchAuth ? params.get('code') : null
  const [hasCode] = useState(code != null)

  const getYoutubeLoginUrlRequest = useRequest(getYoutubeLoginUrl())
  const linkYoutubeChannelRequest = useRequest(linkYoutubeChannel(code!), {
    onDemand: true,
    onDone: updateKey
  })
  const getTwitchLoginUrlRequest = useRequest(getTwitchLoginUrl())
  const linkTwitchChannelRequest = useRequest(linkTwitchChannel(code!), {
    onDemand: true,
    onDone: updateKey
  })

  useEffect(() => {
    if (isYoutubeAuth || isTwitchAuth) {
      setParams({})
    }

    if (code != null) {
      linkYoutubeChannelRequest.reset()
      linkTwitchChannelRequest.reset()
      if (isYoutubeAuth) {
        linkYoutubeChannelRequest.triggerRequest()
      } else if (isTwitchAuth) {
        linkTwitchChannelRequest.triggerRequest()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    updateKey()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.admin_selectedAggregateUserId])

  const linkChannelByAdminRequest = useRequest(addLinkedChannel(selectedAggregateUserId!, props.admin_selectedDefaultUserId!), {
    onDemand: true,
    onRequest: () => onConfirmRequest('Are you sure you wish to link the user?'),
    onDone: updateKey
  })

  return (
    <div>
      {props.admin_selectedAggregateUserId == null && props.admin_selectedDefaultUserId == null && <>
        <h3>How does this work?</h3>
        <div>You can link a YouTube or Twitch channel to your ChatMate account to manage your profile and access other exclusive features.</div>
        <div>Linking multiple channels is supported. All existing data you have acquired on those channels (experience, ranks, etc.) will be merged as if you were using a single channel all along.</div>
        <div>You can link a maximum of {MAX_CHANNEL_LINKS_ALLOWED} channels across YouTube and Twitch.</div>

        <Alert sx={{ mt: 1, mb: 1, width: 'fit-content' }} severity="warning">
          Each channel can only be linked to one ChatMate account - make sure <b>{loginContext.username}</b> is the account you want to link to, as it cannot be undone.
        </Alert>
        {legacyView ? <>
          How to link a channel:
          <ol>
            <li>
              <b>Specify the channel. </b>
                In the below input field, enter either the YouTube channel ID or Twitch channel name that you wish to link.
            </li>
            <li>
              <b>Prove channel ownership. </b>
              Ensure you are logged in to the channel you want to link.
              Head over to a ChatMate-enabled livestream and paste the provided command shown in the Link History section to the chat.
              The official ChatMate channels below can be used for this purpose, or the channel of the current streamer you are watching, if any.
              {getOfficialChatMateStreamerRequest.data != null && <StreamerLinks streamerSummary={getOfficialChatMateStreamerRequest.data.chatMateStreamer} />}
            </li>
            <li>
              <b>Wait for a few seconds. </b>
                Once you have sent the link command to the stream chat, the link process will be initiated and should complete within a few seconds. Its status can be checked below.
            </li>
          </ol>

          {getLinkedChannelsRequest.data != null &&
            <CreateLinkToken
              isLoading={getLinkedChannelsRequest.isLoading || getPrimaryChannelsRequest.isLoading}
              linkedCount={getLinkedChannelsRequest.data.channels.length}
              onCreated={updateKey}
            />
          }
          <ApiLoading requestObj={[getLinkedChannelsRequest, getOfficialChatMateStreamerRequest, getPrimaryChannelsRequest]} initialOnly />
          <ApiError requestObj={[getLinkedChannelsRequest, getOfficialChatMateStreamerRequest, getPrimaryChannelsRequest]} />

          <Alert severity="info" sx={{ width: 'fit-content' }}>
            This is the legacy way of linking channels, which does not require you to trust ChatMate with your account information. <Link component="button" variant="body2" onClick={() => setParams()}>Switch to the modern way.</Link>
          </Alert>
        </> : <>
          How to link a channel:
          <ol>
            <li>
              Select your channel's platform using one of the below buttons.
            </li>
            <li>
              Grant access for ChatMate to read your channel info. <Link component="button" variant="body1" onClick={() => setParams({ [LEGACY_VIEW_QUERY_PARAM]: 'true' })}>If you encounter issues, try using the old, trustless way of linking.</Link>
            </li>
            <li>
              Confirm that your channel is now shown in the Linked Channels section.
            </li>
          </ol>

          <Link href={getYoutubeLoginUrlRequest.data?.url ?? ''}><Button sx={{ mr: 2 }} disabled={getYoutubeLoginUrlRequest.data == null}>Link Youtube Channel</Button></Link>
          <Link href={getTwitchLoginUrlRequest.data?.url ?? ''}><Button sx={{ mr: 2 }} disabled={getTwitchLoginUrlRequest.data == null}>Link Twitch Channel</Button></Link>

          {hasCode &&
            <>
              {(linkYoutubeChannelRequest.data != null || linkTwitchChannelRequest.data != null) &&
                <Alert sx={{ mt: 1 }} severity="success">
                  Successfully linked your channel to ChatMate.
                </Alert>
              }
              <ApiLoading requestObj={[linkYoutubeChannelRequest, linkTwitchChannelRequest]}>Linking your channel. Please wait...</ApiLoading>
              <ApiError requestObj={[linkYoutubeChannelRequest, linkTwitchChannelRequest]} hideRetryButton />
            </>
          }
        </>}
      </>}

      {/* allow admin to link an aggregate user to the selected default user */}
      {props.admin_selectedDefaultUserId != null && <>
        <div>Link an aggregate user:</div>
        <TextField
          label="Aggregate user id"
          inputMode="numeric"
          style={{ display: 'block' }}
          onChange={e => setSelectedAggregateUserId(e.target.value === '' ? null : Number(e.target.value))}
        />
        <Button
          disabled={linkChannelByAdminRequest.isLoading || selectedAggregateUserId == null}
          sx={{ mt: 2 }}
          onClick={linkChannelByAdminRequest.triggerRequest}>
            Link
        </Button>
        <ApiLoading requestObj={linkChannelByAdminRequest} />
        <ApiError requestObj={linkChannelByAdminRequest} />
        {linkChannelByAdminRequest.data != null && <div>Success!</div>}
      </>}

      {props.admin_selectedAggregateUserId == null && props.admin_selectedDefaultUserId != null ?
        <div>Selected a default user - no linked channels to show.</div>
        :
        <div style={{ marginBottom: 16 }}>
          <LinkedChannels
            channelsRequestObj={getLinkedChannelsRequest}
            primaryChannelsRequestObj={loginContext.isStreamer ? getPrimaryChannelsRequest : null}
            onChange={updateKey}
            onRefresh={updateKey}
          />
        </div>
      }
      {props.admin_selectedAggregateUserId == null && props.admin_selectedDefaultUserId != null ?
        <div>Selected a default user - no link history to show.</div>
        :
        <LinkHistory
          updateKey={key}
          admin_selectedAggregateUserId={props.admin_selectedAggregateUserId}
          onRefresh={updateKey}
          chatMateStreamer={getOfficialChatMateStreamerRequest.data?.chatMateStreamer ?? null}
        />
      }
      {/* These must be null to avoid infinite recursion */}
      {props.admin_selectedAggregateUserId == null && props.admin_selectedDefaultUserId == null &&
        <RequireRank admin>
          <>
            <AdminLink />
            <LinkAttemptLogs />
          </>
        </RequireRank>
      }
    </div>
  )
}
