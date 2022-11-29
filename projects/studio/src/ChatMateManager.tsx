import { assertUnreachable } from '@rebel/server/util/typescript'
import { getStatus, getStreamlabsStatus, setActiveLivestream, setStreamlabsSocketToken } from '@rebel/studio/api'
import ApiRequest from '@rebel/studio/ApiRequest'
import ApiRequestTrigger from '@rebel/studio/ApiRequestTrigger'
import * as React from 'react'

type Props = { }

type State = {
  currentLivestreamInput: string
  currentSocketInput: string
  socketMessage: string | null
}

export default class ChatMateManager extends React.PureComponent<Props, State> {
  constructor (props: Props) {
    super(props)

    this.state = {
      currentLivestreamInput: '',
      currentSocketInput: '',
      socketMessage: null
    }
  }

  onChangeLivestreamInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ currentLivestreamInput: e.target.value })
  }

  onChangeSocketInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ currentSocketInput: e.target.value })
  }

  setStatus = (loginToken: string, streamer: string) => {
    const livestream = this.state.currentLivestreamInput.trim()
    return setActiveLivestream(livestream === '' ? null : livestream, loginToken, streamer)
  }

  getStatus = async (loginToken: string, streamer: string) => {
    const response = await getStatus(loginToken, streamer)
    if (response.success) {
      this.setState({ currentLivestreamInput: response.success ? response.data.livestreamStatus?.livestream.livestreamLink ?? '' : this.state.currentLivestreamInput })
    }
    return response
  }

  setToken = async (loginToken: string, streamer: string) => {
    this.setState({ socketMessage: null })

    const socket = this.state.currentSocketInput.trim()
    const response = await setStreamlabsSocketToken(loginToken, streamer, socket === '' ? null : socket)

    if (response.success) {
      let socketMessage: string
      if (socket === '' && response.data.result === 'success') {
        socketMessage = 'Removed socket token. You are no longer listening to StreamLabs donations.'
      } else if (socket === '' && response.data.result === 'noChange') {
        socketMessage = 'Could not find a token to remove. You are not listening to StreamLabs donations.'
      } else if (response.data.result === 'success') {
        socketMessage = 'Added socket token. You are now listening to StreamLabs donations.'
      } else if (response.data.result === 'noChange') {
        socketMessage = 'Token already exists. You are still listening to StreamLabs donations.'
      } else {
        assertUnreachable(response.data.result)
      }

      this.setState({
        currentSocketInput: '',
        socketMessage: socketMessage
      })
    }

    return response
  }

  override render() {
    return <div style={{ display: 'block' }}>
      <h3>Active Livestream</h3>
      <div>Set the active YouTube livestream that ChatMate should listen to.</div>
      <ApiRequest onDemand token={1} requiresStreamer onRequest={this.getStatus}>
        <ApiRequestTrigger requiresStreamer onRequest={this.setStatus}>
          {(onSetStatus, status, loading, error) => <>
            <input onChange={this.onChangeLivestreamInput} disabled={loading != null} placeholder='No active livestream' value={this.state.currentLivestreamInput} />
            <button onClick={onSetStatus} disabled={loading != null}>Set active livestream</button>
            {error}
          </>}
        </ApiRequestTrigger>
      </ApiRequest>

      <h3>Donations</h3>
      <div style={{ marginTop: 4, marginBottom: 4 }}>
        <ApiRequest repeatInterval={5000} requiresStreamer onDemand={false} onRequest={getStreamlabsStatus}>
          {(data, loadingNode, errorNode) => {
            if (data) {
              if (data.status === 'listening') {
                return <div>ChatMate is <b style={{ color: 'green' }}>listening</b> to your Streamlabs donations.</div>
              } else if (data.status === 'notListening') {
                return <div>ChatMate is <b style={{ color: 'red' }}>not listening</b> to your Streamlabs donations. You can set the socket token below to start listening.</div>
              } else if (data.status === 'error') {
                return <div>Looks like something went wrong, and ChatMate is probably <b style={{ color: 'red' }}>not listening</b> to your Streamlabs donations. <br />
                  It is recommendd that you reset the socket token below.</div>
              } else {
                assertUnreachable(data.status)
              }
            } else if (loadingNode) {
              return loadingNode
            } else {
              return errorNode
            }
          }}
        </ApiRequest>
      </div>

      <div>
        Set the StreamLabs socket token to listen for donations. If the token field is left blank, ChatMate will stop listening to donations.<br />
        You can get your StreamLabs socket token by going to {<a href="https://streamlabs.com/dashboard#/settings/api-settings">your dashboard</a>} -&gt; API Tokens tab -&gt; copying the Socket API Token.
      </div>
      <ApiRequestTrigger requiresStreamer onRequest={this.setToken}>
        {(onSetToken, status, loading, error) => <>
          <input onChange={this.onChangeSocketInput} disabled={loading != null} value={this.state.currentSocketInput} />
          <button onClick={onSetToken} disabled={loading != null}>Set token</button>
          {error}
        </>}
      </ApiRequestTrigger>
      <div>{this.state.socketMessage}</div>
    </div>
  }
}
