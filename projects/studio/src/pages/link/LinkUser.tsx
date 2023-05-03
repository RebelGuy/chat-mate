import AdminLink from '@rebel/studio/pages/link/AdminLink'
import { addLinkedChannel, getChatMateRegisteredUsername, getLinkedChannels, getPrimaryChannels } from '@rebel/studio/utility/api'
import RequireRank from '@rebel/studio/components/RequireRank'
import LinkedChannels from '@rebel/studio/pages/link/LinkedChannels'
import { LinkHistory } from '@rebel/studio/pages/link/LinkHistory'
import * as React from 'react'
import { MAX_CHANNEL_LINKS_ALLOWED } from '@rebel/shared/constants'
import { Alert, Button, TextField } from '@mui/material'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { CreateLinkToken } from '@rebel/studio/pages/link/CreateLinkToken'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import useRequest, { onConfirmRequest } from '@rebel/studio/hooks/useRequest'
import ApiLoading from '@rebel/studio/components/ApiLoading'
import ApiError from '@rebel/studio/components/ApiError'
import StreamerLinks from '@rebel/studio/components/StreamerLinks'

// props are the user details of the currently selected user in the admin context. changed by searching for another user
export default function LinkUser (props: { admin_selectedAggregateUserId?: number, admin_selectedDefaultUserId?: number }) {
  const loginContext = React.useContext(LoginContext)
  const [key, updateKey] = useUpdateKey()

  // the user to link to
  const [selectedAggregateUserId, setSelectedAggregateUserId] = React.useState<number | null>()

  const getLinkedChannelsRequest = useRequest(getLinkedChannels(props.admin_selectedAggregateUserId), { updateKey: key })
  const getPrimaryChannelsRequest = useRequest(getPrimaryChannels(), { updateKey: key })
  const getChatMateRegisteredUsernameRequest = useRequest(getChatMateRegisteredUsername())

  React.useEffect(() => {
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

        How to link a channel:
        <ol>
          <li>
            <b>Specify the channel. </b>
              In the below input field, enter either the YouTube channel ID or Twitch channel name.
          </li>
          <li>
            <b>Prove channel ownership. </b>
            Paste the provided command shown in the Link History section to the YouTube/Twitch chat (corresponding to the platform of the channel you want to link).
            You can use either the official ChatMate channels below, or any other streamer channel registered on Chatmate:
            {getChatMateRegisteredUsernameRequest.data != null && <StreamerLinks streamerName={getChatMateRegisteredUsernameRequest.data.username} />}
          </li>
          <li>
            <b>Wait for a few seconds. </b>
              The link process has been initiated and should complete soon. Its status can be checked below.
          </li>
        </ol>

        {getLinkedChannelsRequest.data != null &&
          <CreateLinkToken
            isLoading={getLinkedChannelsRequest.isLoading || getPrimaryChannelsRequest.isLoading}
            linkedCount={getLinkedChannelsRequest.data.channels.length}
            onCreated={updateKey}
          />
        }
        <ApiLoading requestObj={[getLinkedChannelsRequest, getChatMateRegisteredUsernameRequest, getPrimaryChannelsRequest]} initialOnly />
        <ApiError requestObj={[getLinkedChannelsRequest, getChatMateRegisteredUsernameRequest, getPrimaryChannelsRequest]} />
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
          chatMateUsername={getChatMateRegisteredUsernameRequest.data?.username}
        />
      }
      {/* These must be null to avoid infinite recursion */}
      {props.admin_selectedAggregateUserId == null && props.admin_selectedDefaultUserId == null &&
        <RequireRank admin>
          <AdminLink />
        </RequireRank>
      }
    </div>
  )
}
