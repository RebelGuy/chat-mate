import { assertUnreachable } from '@rebel/shared/util/typescript'
import { getStatus, getStreamlabsStatus, setActiveLivestream, setStreamlabsSocketToken } from '@rebel/studio/utility/api'
import ApiRequest from '@rebel/studio/components/ApiRequest'
import ApiRequestTrigger from '@rebel/studio/components/ApiRequestTrigger'
import * as React from 'react'
import { EmptyObject } from '@rebel/shared/types'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'
import { Button, TextField } from '@mui/material'
import { Box } from '@mui/system'
import { getLiveId } from '@rebel/shared/util/text'
import CopyText from '@rebel/studio/components/CopyText'

type Props = EmptyObject

type State = {
  currentLivestreamInput: string
  lastLivestreamResponse: string
  currentSocketInput: string
  socketMessage: string | null
}

export default class ChatMateManager extends React.PureComponent<Props, State> {
  constructor (props: Props) {
    super(props)

    this.state = {
      currentLivestreamInput: '',
      lastLivestreamResponse: '',
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

  setStatus = async (loginToken: string, streamer: string) => {
    const livestream = this.state.currentLivestreamInput.trim()
    const response = await setActiveLivestream(livestream === '' ? null : livestream, loginToken, streamer)

    if (response.success) {
      this.setState({
        lastLivestreamResponse: this.state.currentLivestreamInput
      })
    }

    return response
  }

  getStatus = async (loginToken: string, streamer: string) => {
    const response = await getStatus(loginToken, streamer)
    if (response.success) {
      this.setState({
        currentLivestreamInput: response.success ? response.data.livestreamStatus?.livestream.livestreamLink ?? '' : this.state.currentLivestreamInput,
        lastLivestreamResponse: response.success ? response.data.livestreamStatus?.livestream.livestreamLink ?? '' : ''
      })
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

  override render () {
    let livestreamIdError: string | null = null
    if (this.state.currentLivestreamInput.length > 0) {
      try {
        getLiveId(this.state.currentLivestreamInput)
      } catch (e: any) {
        livestreamIdError = 'Invalid livestream ID or URL'
      }
    }

    return <div style={{ display: 'block' }}>
      <h3>Active Livestream</h3>
      <div>Set the active YouTube livestream that ChatMate should listen to.</div>
      <ApiRequest onDemand token={1} requiresStreamer onRequest={this.getStatus}>
        <ApiRequestTrigger requiresStreamer onRequest={this.setStatus}>
          {(onSetStatus, status, loading, error) => <>
            <Box style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <TextField
                value={this.state.currentLivestreamInput}
                label="YouTube livestream ID or URL"
                disabled={loading != null}
                style={{ width: 400 }}
                helperText={livestreamIdError}
                error={livestreamIdError != null}
                onChange={this.onChangeLivestreamInput}
              />
              {this.state.currentLivestreamInput.length > 0 && livestreamIdError == null && (
                <CopyText
                  text={this.state.currentLivestreamInput}
                  tooltip="Copy livestream URL"
                  sx={{ ml: 1 }}
                />
              )}
            </Box>
            <Button
              disabled={loading != null || livestreamIdError != null || this.state.lastLivestreamResponse === this.state.currentLivestreamInput}
              sx={{ display: 'block', mt: 1 }}
              onClick={onSetStatus}
            >
              {this.state.currentLivestreamInput.length === 0 ? 'Clear' : 'Set'} active livestream
            </Button>
            {loading}
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
        You can get your StreamLabs socket token by going to {<LinkInNewTab href="https://streamlabs.com/dashboard#/settings/api-settings">your dashboard</LinkInNewTab>} -&gt; API Tokens tab -&gt; copying the Socket API Token.
      </div>
      <ApiRequestTrigger requiresStreamer onRequest={this.setToken}>
        {(onSetToken, status, loading, error) => <>
          <TextField
            value={this.state.currentSocketInput}
            label="Socket token"
            disabled={loading != null}
            style={{ width: 400 }}
            onChange={this.onChangeSocketInput}
          />
          <Button
            disabled={loading != null}
            sx={{ display: 'block', mt: 1 }}
            onClick={onSetToken}
          >
            {this.state.currentSocketInput.length === 0 ? 'Clear' : 'Set'} token
          </Button>
          {error}
        </>}
      </ApiRequestTrigger>
      <div>{this.state.socketMessage}</div>
    </div>
  }
}
