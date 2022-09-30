import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import * as React from 'react'

type Props = {
  disabled: boolean
  ranks: number[]
  accessibleRanks: PublicRank[]
  onChange: (newRanks: number[]) => void
}

export default class RanksSelector extends React.PureComponent<Props> {
  private toggleCheckbox (rankId: number) {
    let ranks = this.props.ranks
    if (ranks.includes(rankId)) {
      ranks = ranks.filter(r => r !== rankId)
    } else {
      ranks.push(rankId)
    }
    this.props.onChange(ranks)
  }

  override render (): React.ReactNode {
    const whitelistedRanks = this.props.accessibleRanks.filter(r => this.props.ranks.includes(r.id))
    const inaccessibleRankCount = this.props.ranks.filter(id => !this.props.accessibleRanks.map(r => r.id).includes(id)).length
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
          {this.props.accessibleRanks.map(r => (
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
          {inaccessibleRankString}
        </div>
      )
    }
  }
}

function toSentenceCase (str: string) {
  return str[0].toUpperCase() + str.substring(1)
}
