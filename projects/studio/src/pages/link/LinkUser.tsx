import AdminLink from '@rebel/studio/pages/link/AdminLink'
import { addLinkedChannel, createLinkToken, getLinkedChannels, getLinkHistory, getPrimaryChannels } from '@rebel/studio/utility/api'
import ApiRequest from '@rebel/studio/components/ApiRequest'
import ApiRequestTrigger from '@rebel/studio/components/ApiRequestTrigger'
import RequireRank from '@rebel/studio/components/RequireRank'
import LinkedChannels from '@rebel/studio/pages/link/LinkedChannels'
import { LinkHistory } from '@rebel/studio/pages/link/LinkHistory'
import * as React from 'react'
import { MAX_CHANNEL_LINKS_ALLOWED } from '@rebel/shared/constants'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, IconButton, TextField } from '@mui/material'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { Refresh } from '@mui/icons-material'
import { CreateLinkToken } from '@rebel/studio/pages/link/CreateLinkToken'

// props are the user details of the currently selected user in the admin context. changed by searching for another user
export default function LinkUser (props: { admin_selectedAggregateUserId?: number, admin_selectedDefaultUserId?: number }) {
  const loginContext = React.useContext(LoginContext)
  const [updateToken, setUpdateToken] = React.useState(Date.now())
  const [linkedCount, setLinkedCount] = React.useState(0)

  // the user to link to
  const [selectedAggregateUserId, setSelectedAggregateUserId] = React.useState<number | null>()

  React.useEffect(() => {
    setUpdateToken(Date.now())
  }, [props.admin_selectedAggregateUserId])

  const regenerateUpdateToken = () => setUpdateToken(Date.now())

  // for some reason the output type is not accepted when these are put in-line, but works fine when saved as a variable first
  const onGetLinkHistory = (loginToken: string) => getLinkHistory(loginToken, props.admin_selectedAggregateUserId)
  const onGetLinkedChannels = async (loginToken: string) => {
    const response = await getLinkedChannels(loginToken, props.admin_selectedAggregateUserId)

    if (response.success) {
      setLinkedCount(response.data.channels.length)
    }

    return response
  }
  const onAddLinkedChannel = (loginToken: string) => {
    if (!window.confirm('Are you sure you wish to link the user?')) {
      throw new Error('Aborted')
    }

    return addLinkedChannel(loginToken, selectedAggregateUserId!, props.admin_selectedDefaultUserId!)
  }

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
              Paste the provided command in the YouTube/Twitch chat (corresponding to the platform of the channel you want to link).
          </li>
          <li>
            <b>Wait for a few seconds. </b>
              The link process has been initiated and should complete soon. Its status can be checked below.
          </li>
        </ol>
      </>}

      {/* allow admin to link an aggregate user to the selected default user */}
      {props.admin_selectedDefaultUserId != null && <>
        <ApiRequestTrigger onRequest={onAddLinkedChannel}>
          {(onMakeRequest, response, loadingNode, errorNode) => <>
            <div>Link an aggregate user:</div>
            <TextField
              label="Aggregate user id"
              inputMode="numeric"
              style={{ display: 'block' }}
              onChange={e => setSelectedAggregateUserId(e.target.value === '' ? null : Number(e.target.value))}
            />
            <Button
              disabled={loadingNode != null || selectedAggregateUserId == null}
              sx={{ mt: 2 }}
              onClick={onMakeRequest}>
                Link
            </Button>
            {response != null && <div>Success!</div>}
            {errorNode}
          </>}
        </ApiRequestTrigger>
      </>}

      {props.admin_selectedAggregateUserId == null && props.admin_selectedDefaultUserId != null ?
        <div>Selected a default user - no linked channels to show.</div>
        :
        <div style={{ marginBottom: 16 }}>
          <ApiRequest onDemand token={updateToken} onRequest={onGetLinkedChannels}>
            {(response1, loadingNode1, errorNode1) => <>
              <ApiRequest onDemand token={updateToken} onRequest={getPrimaryChannels}>
                {(response2, loadingNode2, errorNode2) => <>
                  {response1 && (
                    <LinkedChannels channels={response1.channels} primaryChannels={response2 ?? { youtubeChannelId: null, twitchChannelId: null }} onChange={regenerateUpdateToken} onRefresh={regenerateUpdateToken} />
                  )}
                  {loadingNode1 || loadingNode2}
                  {errorNode1}
                </>}
              </ApiRequest>
            </>}
          </ApiRequest>
        </div>
      }
      {props.admin_selectedAggregateUserId == null && props.admin_selectedDefaultUserId != null ?
        <div>Selected a default user - no link history to show.</div>
        :
        <ApiRequest onDemand token={updateToken} onRequest={onGetLinkHistory}>
          {(response, loadingNode, errorNode) => <>
            {response && <>
              <LinkHistory data={response} onRefresh={regenerateUpdateToken} />
              {props.admin_selectedAggregateUserId == null && <CreateLinkToken linkedCount={linkedCount} onCreated={regenerateUpdateToken} />}
            </>}
            {loadingNode}
            {errorNode}
          </>}
        </ApiRequest>
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
