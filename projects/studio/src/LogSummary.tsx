import { GetTimestampsResponse } from '@rebel/server/controllers/LogController'
import { PublicLogTimestamps } from '@rebel/server/controllers/public/log/PublicLogTimestamps'
import { formatTime } from '@rebel/server/util/datetime'
import { getLogTimestamps } from '@rebel/studio/api'
import * as React from 'react'

type Props = {

}

type State = {
  lastResponse: GetTimestampsResponse | null
}

export default class LogSummary extends React.PureComponent<Props, State> {
  private timer: number | null = null

  constructor (props: Props) {
    super(props)

    this.state = {
      lastResponse: null
    }
  }

  loadTimestamps = async () => {
    this.setState({ lastResponse: null })
    const response = await getLogTimestamps()
    this.setState({ lastResponse: response })

    this.timer = window.setTimeout(this.loadTimestamps, 5000)
  }

  override componentDidMount () {
    this.loadTimestamps()
  }

  override componentWillUnmount () {
    if (this.timer != null) {
      clearTimeout(this.timer)
    }
  }

  renderTimestamps = (timestamps: PublicLogTimestamps) => {
    const renderLast = (timestamps: number[]) => {
      if (timestamps.length === 0) {
        return null
      } else {
        const last = timestamps.at(-1)!
        return ` (last at ${formatTime(new Date(last))})`
      }
    }

    return <div style={{ display: 'block' }}>
      <div>Errors: {timestamps.errors.length}{renderLast(timestamps.errors)}</div>
      <div>Warnings: {timestamps.warnings.length}{renderLast(timestamps.warnings)}</div>
    </div>
  }

  override render () {
    let contents: React.ReactNode
    if (this.state.lastResponse == null) {
      contents = <div>Loading...</div> 
    } else if (!this.state.lastResponse.success) {
      contents = <div>Error: {this.state.lastResponse.error.message}</div>
    } else {
      contents = this.renderTimestamps(this.state.lastResponse.data.timestamps)
    }

    return <div style={{ height: '3em' }}>
      {contents}
    </div>
  }
}
