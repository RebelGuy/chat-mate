import { getStatus, setActiveLivestream } from '@rebel/studio/api'
import * as React from 'react'

type Props = { }

type State = {
  loading: boolean
  error: string | null
  currentInput: string
}

export default class ChatMateManager extends React.PureComponent<Props, State> {
  constructor (props: Props) {
    super(props)

    this.state = {
      loading: false,
      error: null,
      currentInput: ''
    }
  }

  loadStatus = async () => {
    this.setState({ loading: true })
    const response = await getStatus()
    this.setState({
      loading: false,
      currentInput: response.success ? response.data.livestreamStatus?.livestreamLink ?? '' : this.state.currentInput,
      error: response.success ? null : response.error.message
    })
  }

  setLivestream = async (newLivestream: string | null) => {
    this.setState({ loading: true })
    const response = await setActiveLivestream(newLivestream)
    this.setState({
      loading: false,
      currentInput: response.success ? newLivestream ?? '' : this.state.currentInput,
      error: response.success ? null : response.error.message
    })
  }

  onChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ currentInput: e.target.value })
  }

  onSubmit = () => {
    const livestream = this.state.currentInput.trim()
    this.setLivestream(livestream === '' ? null : livestream)
  }

  override componentDidMount () {
    this.loadStatus()
  }

  override render() {
    return <div style={{ display: 'block' }}>
      <input onChange={this.onChangeInput} disabled={this.state.loading} placeholder='No active livestream' value={this.state.currentInput} />
      <button onClick={this.onSubmit} disabled={this.state.loading}>Set active livestream</button>
      {this.state.error != null && <p style={{ color: 'red' }}>{this.state.error}</p>}
    </div>
  }
}