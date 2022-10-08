import { getStatus, setActiveLivestream } from '@rebel/studio/api'
import ApiRequest from '@rebel/studio/ApiRequest'
import ApiRequestTrigger from '@rebel/studio/ApiRequestTrigger'
import * as React from 'react'

type Props = { }

type State = {
  currentInput: string
}

export default class ChatMateManager extends React.PureComponent<Props, State> {
  constructor (props: Props) {
    super(props)

    this.state = {
      currentInput: ''
    }
  }

  onChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ currentInput: e.target.value })
  }

  setStatus = () => {
    const livestream = this.state.currentInput.trim()
    return setActiveLivestream(livestream === '' ? null : livestream)
  }

  getStatus = async () => {
    const response = await getStatus()
    if (response.success) {
      this.setState({ currentInput: response.success ? response.data.livestreamStatus?.livestream.livestreamLink ?? '' : this.state.currentInput })
    }
    return response
  }

  override render() {
    return <div style={{ display: 'block' }}>
      <ApiRequest onDemand token={1} onRequest={this.getStatus}>
        <ApiRequestTrigger onRequest={this.setStatus}>
          {(onSetStatus, status, loading, error) => <>
            <input onChange={this.onChangeInput} disabled={loading != null} placeholder='No active livestream' value={this.state.currentInput} />
            <button onClick={onSetStatus} disabled={loading != null}>Set active livestream</button>
            {error}
          </>}
        </ApiRequestTrigger>
      </ApiRequest>
    </div>
  }
}
