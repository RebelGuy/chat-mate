import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import { getAccessibleRanks } from '@rebel/studio/api'
import * as React from 'react'

type Props = {
  disabled: boolean
  ranks: number[]
  onChange: (newRanks: number[]) => void
}

type State = {
  loading: boolean
  error: string | null
  accessibleRanks: PublicRank[]
}

export default class RanksSelector extends React.PureComponent<Props, State> {
  constructor (props: Props) {
    super(props)

    this.state = {
      loading: false,
      error: null,
      accessibleRanks: []
    }
  }

  private toggleCheckbox (rankId: number) {
    let ranks = this.props.ranks
    if (ranks.includes(rankId)) {
      ranks = ranks.filter(r => r !== rankId)
    } else {
      ranks.push(rankId)
    }
    this.props.onChange(ranks)
  }

  override async componentDidMount () {
    this.setState({ loading: true })

    try {
      const response = await getAccessibleRanks()
      if (response.success) {
        this.setState({
          accessibleRanks: response.data.accessibleRanks,
          error: null
        })
      } else {
        this.setState({
          accessibleRanks: [],
          error: response.error.message
        })
      }
    } catch (e: any) {
      this.setState({
        accessibleRanks: [],
        error: e.message
      })
    }
    
    this.setState({ loading: false })
  }

  override render (): React.ReactNode {
    if (this.state.error) {
      return <div style={{ color: 'red' }}>{this.state.error}</div>
    } else if (this.state.loading) {
      return <div>Loading...</div>
    }

    const whitelistedRanks = this.state.accessibleRanks.filter(r => this.props.ranks.includes(r.id))
    const inaccessibleRankCount = this.props.ranks.filter(id => !this.state.accessibleRanks.map(r => r.id).includes(id)).length
    const inaccessibleRankString = inaccessibleRankCount === 0 ? '' : ` (and ${inaccessibleRankCount} inaccessible ranks)`

    if (this.props.disabled) {
      if (this.props.ranks.length === 0) {
        return <div>--</div>
      } else {
        return <div>{whitelistedRanks.map(r => toSentenceCase(r.displayNameNoun)).join(', ')}{inaccessibleRankString}</div>
      }
    } else {
      return (
        <div style={{ textAlign: 'left' }}>
          {this.state.accessibleRanks.map(r => (
            <div key={r.id}>
              <input
                type="checkbox"
                checked={this.props.ranks.includes(r.id)}
                onChange={() => this.toggleCheckbox(r.id)}
                name={r.name}
              />
              <label htmlFor={r.name}>{toSentenceCase(r.displayNameNoun)}</label>
            </div>
          ))}
          {}
          {inaccessibleRankString}
        </div>
      )
    }
  }
}

function toSentenceCase (str: string) {
  return str[0].toUpperCase() + str.substring(1)
}
