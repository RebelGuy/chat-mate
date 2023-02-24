import { ApiResponse } from '@rebel/server/controllers/ControllerBase'
import { PublicStreamerApplication } from '@rebel/server/controllers/public/user/PublicStreamerApplication'
import { GetApplicationsResponse } from '@rebel/server/controllers/StreamerController'
import { sortBy } from '@rebel/shared/util/arrays'
import { capitaliseWord } from '@rebel/shared/util/text'
import { approveStreamerApplication, createStreamerApplication, getStreamerApplications, rejectStreamerApplication, withdrawStreamerApplication } from '@rebel/studio/utility/api'
import ApiRequest from '@rebel/studio/components/ApiRequest'
import ApiRequestTrigger from '@rebel/studio/components/ApiRequestTrigger'
import Form from '@rebel/studio/components/Form'
import RequireRank from '@rebel/studio/components/RequireRank'
import * as React from 'react'

export default function ApplyForStreamer () {
  const [updateToken, setUpdateToken] = React.useState(new Date().getTime())

  const regenerateUpdateToken = () => setUpdateToken(new Date().getTime())

  return (
    <ApiRequest onDemand={true} token={updateToken} onRequest={getStreamerApplications}>
      {(response, loadingNode, errorNode) => <>
        <RequireRank anyOwner inverted>
          <ApplicationForm disabled={response != null && response.streamerApplications.find(app => app.status === 'pending') != null} onApplicationCreated={regenerateUpdateToken} />
        </RequireRank>
        <ApplicationHistory data={response} loadingNode={loadingNode} errorNode={errorNode} onApplicationUpdated={regenerateUpdateToken} />
      </>}
    </ApiRequest>
  )
}

type ApplicationFormProps = {
  disabled: boolean
  onApplicationCreated: () => void
}

function ApplicationForm (props: ApplicationFormProps) {
  const [message, setMessage] = React.useState('')

  const onCreateApplication = async (loginToken: string) => {
    const result = await createStreamerApplication(loginToken, message)
    if (result.success) {
      props.onApplicationCreated()
      setMessage('')
    }
    return result
  }

  return <>
    <div>Use the form to request participation in the ChatMate Beta Program.</div>
    <div>Once accepted, you will be able to indicate the channel(s) you will be streaming on, on Twitch and/or YouTube.</div>
    <ApiRequestTrigger onRequest={onCreateApplication}>
      {(onMakeRequest, responseData, loadingNode, errorNode) => (
        <Form onSubmit={onMakeRequest} style={{ display: 'flex', flexDirection: 'column', maxWidth: 400, margin: 'auto' }}>
          <textarea disabled={props.disabled || loadingNode != null} placeholder="Type your message here" value={message} onChange={e => setMessage(e.target.value)} style={{ width: '100%' }} />
          <button type="submit" disabled={props.disabled || loadingNode != null} onClick={onMakeRequest} style={{ width: '100%' }}>Submit</button>
          {loadingNode}
          {errorNode}
        </Form>
      )}
    </ApiRequestTrigger>
  </>
}

type ApplicationHistoryProps = {
  data: Extract<GetApplicationsResponse, { success: true }>['data'] | null
  loadingNode: React.ReactNode | null
  errorNode: React.ReactNode | null
  onApplicationUpdated: () => void
}

function ApplicationHistory (props: ApplicationHistoryProps) {
  return (
    <>
      <h3>Applications</h3>
      {props.data && <table style={{ width: '100%', maxWidth: 800, margin: 'auto' }}>
        <tbody>
          <tr>
            <th>Status</th>
            <th>Date</th>
            <th>User</th>
            <th>Message</th>
            <th>Response</th>
            <th>Action</th>
          </tr>
          {sortBy(props.data.streamerApplications, app => app.timeCreated, 'desc').map(app =>
            <ApplicationRow
              key={app.id}
              application={app}
              onApplicationUpdated={props.onApplicationUpdated}
            />
          )}
        </tbody>
      </table>}
      {props.loadingNode}
      {props.errorNode}
    </>
  )
}

type ApplicationRowProps = {
  application: PublicStreamerApplication
  onApplicationUpdated: () => void
}

function ApplicationRow (props: ApplicationRowProps) {
  return (
    <tr>
      <td>{capitaliseWord(props.application.status)}</td>
      <td>{new Date(props.application.timeCreated).toLocaleString()}</td>
      <td>{props.application.username}</td>
      <td>{props.application.message}</td>
      <td>{props.application.closeMessage ?? 'n/a'}</td>
      <td><ApplicationActions {...props} /></td>
    </tr>
  )
}

type ApplicationActionProps = {
  application: PublicStreamerApplication
  onApplicationUpdated: () => void
}

function ApplicationActions (props: ApplicationActionProps) {
  if (props.application.status !== 'pending') {
    return null
  }

  const onRequestDone = <T extends ApiResponse<any>>(response: T) => {
    if (response.success) {
      props.onApplicationUpdated()
    }
    return response
  }

  const normalContent = (
    <ApiRequestTrigger
      onRequest={(loginToken) => withdrawStreamerApplication(loginToken, props.application.id, 'Withdrawn by user').then(onRequestDone)}
    >
      {(onMakeRequest, response, loadingNode, errorNode) => <>
        <button onClick={onMakeRequest} disabled={loadingNode != null}>Withdraw</button>
        {errorNode}
      </>}
    </ApiRequestTrigger>
  )

  return (
    <RequireRank admin forbidden={normalContent}>
      <div>
        <ApiRequestTrigger
          onRequest={(loginToken) => approveStreamerApplication(loginToken, props.application.id, 'Approved by admin').then(onRequestDone)}
        >
          {(onMakeRequest, response, loadingNode, errorNode) => <>
            <button onClick={onMakeRequest} disabled={loadingNode != null}>Approve</button>
            {errorNode}
          </>}
        </ApiRequestTrigger>
        <ApiRequestTrigger
          onRequest={(loginToken) => rejectStreamerApplication(loginToken, props.application.id, 'Rejected by admin').then(onRequestDone)}
        >
          {(onMakeRequest, response, loadingNode, errorNode) => <>
            <button onClick={onMakeRequest} disabled={loadingNode != null}>Reject</button>
            {errorNode}
          </>}
        </ApiRequestTrigger>
      </div>
    </RequireRank>
  )
}
