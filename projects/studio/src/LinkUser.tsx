import { PublicUserRank } from '@rebel/server/controllers/public/rank/PublicUserRank'
import AdminLink from '@rebel/studio/AdminLink'
import { addLinkedChannel, createLinkToken, getGlobalRanks, getLinkedChannels, getLinkHistory } from '@rebel/studio/api'
import ApiRequest from '@rebel/studio/ApiRequest'
import ApiRequestTrigger from '@rebel/studio/ApiRequestTrigger'
import LinkedChannels from '@rebel/studio/LinkedChannels'
import { LinkHistory } from '@rebel/studio/LinkHistory'
import * as React from 'react'

// props are the user details of the currently selected user in the admin context. changed by searching for another user
export default function LinkUser (props: { admin_selectedAggregateUserId?: number, admin_selectedDefaultUserId?: number }) {
  const [updateToken, setUpdateToken] = React.useState(Date.now())
  const [userRanks, setUserRanks] = React.useState<PublicUserRank[]>([])

  // the user to link to
  const [selectedAggregateUserId, setSelectedAggregateUserId] = React.useState<number | null>()

  React.useEffect(() => {
    setUpdateToken(Date.now())
  }, [props.admin_selectedAggregateUserId])

  const regenerateUpdateToken = () => setUpdateToken(Date.now())
  const getRanks = async (loginToken: string) => {
    const response = await getGlobalRanks(loginToken)

    if (response.success) {
      setUserRanks(response.data.ranks)
    }

    return response
  }

  // for some reason the output type is not accepted when these are put in-line, but works fine when saved as a variable first
  const onGetLinkedChannels = (loginToken: string) => getLinkedChannels(loginToken, props.admin_selectedAggregateUserId)
  const onGetLinkHistory = (loginToken: string) => getLinkHistory(loginToken, props.admin_selectedAggregateUserId)
  const onAddLinkedChannel = (loginToken: string) => addLinkedChannel(loginToken, selectedAggregateUserId!, props.admin_selectedDefaultUserId!)

  const isAdmin = userRanks.find(r => r.rank.name === 'admin') != null

  return (
    <div>
      <ApiRequest onDemand token={updateToken} onRequest={getRanks} />
      <button style={{ display: 'block', margin: 'auto', marginBottom: 32 }} onClick={regenerateUpdateToken}>Refresh</button>
      
      {props.admin_selectedDefaultUserId != null && <>
        <ApiRequestTrigger onRequest={onAddLinkedChannel}>
          {(onMakeRequest, response, loadingNode, errorNode) => <>
            <div>Link an aggregate user:</div>
            <input type="number" onChange={e => setSelectedAggregateUserId(e.target.value === '' ? null : Number(e.target.value))} />
            <button disabled={loadingNode != null || selectedAggregateUserId == null} onClick={onMakeRequest}>Link</button>
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
            {(response, loadingNode, errorNode) => <>
              {response && <LinkedChannels channels={response.channels} isAdmin={isAdmin} onChange={regenerateUpdateToken} />}
              {loadingNode}
              {errorNode}
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
              <LinkHistory data={response} />
              {props.admin_selectedAggregateUserId == null && <CreateLinkToken onCreated={regenerateUpdateToken} />}
            </>}
            {loadingNode}
            {errorNode}
          </>}
        </ApiRequest>
      }
      {isAdmin && props.admin_selectedAggregateUserId == null && props.admin_selectedDefaultUserId == null &&
        <div style={{ background: 'rgba(255, 0, 0, 0.2)' }}>
          <AdminLink />
        </div>
      }
    </div>
  )
}

// todo: should also be searchable by username
function CreateLinkToken (props: { onCreated: () => void }) {
  const [channelInput, setChannelInput] = React.useState('')
  const { channelId, error: validationError } = validateChannel(channelInput)
  const showError = channelInput.length > 0 && validationError != null
  
  const onCreateLinkToken = async (loginToken: string) => {
    if (channelId == null) {
      throw new Error('Channel ID is null')
    }
    const result = await createLinkToken(loginToken, channelId)

    if (result.success) {
      props.onCreated()
    }

    return result
  }

  return <div style={{ marginTop: 24 }}>
    <div>You can link a channel to your account to manage your profile and access other exclusive features.</div>
    <div>If linking multiple channels, all data (experience, ranks, etc.) will be merged as if you were using a single account all along. This cannot be undone.</div>
    <ApiRequestTrigger onRequest={onCreateLinkToken}>
      {(onMakeRequest, response, loadingNode, errorNode) =>
        <>
          <input type="text" disabled={loadingNode != null} placeholder="Enter channel URL or ID" value={channelInput} onChange={e => setChannelInput(e.target.value)} />
          {showError && <div color="red">{validationError}</div>}
          {loadingNode}
          {errorNode}
          <button type="button" disabled={loadingNode != null || showError} onClick={onMakeRequest}>Submit</button>
        </>
      }
    </ApiRequestTrigger>
  </div>
}

function validateChannel (channel: string): { channelId: string | null, error: string | null } {
  if (channel.includes('/channel/')) {
    channel = channel.substring(channel.indexOf('/channel/') + '/channel/'.length)
  } else if (channel.includes('twitch.tv/')) {
    channel = channel.substring(channel.indexOf('twitch.tv/') + 'twitch.tv/'.length)
  }

  if (channel.startsWith('UC')) {
    if (channel.length === 24) {
      return { channelId: channel, error: null }
    } else {
      return { channelId: null, error: 'Invalid YouTube channel ID - expected 24 characters' }
    }
  }

  if (channel.includes('!@#$%^&*(){}|;:\'"`~?/>.<,=+[]\\')) {
    return { channelId: null, error: 'Invalid channel ID - includes special characters' }
  }

  return { channelId: channel, error: null }
}
