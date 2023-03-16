import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import { toSentenceCase } from '@rebel/shared/util/text'

type Props = {
  ranks: number[]
  accessibleRanks: PublicRank[]
}

export default function RanksDisplay (props: Props) {
  const whitelistedRanks = props.accessibleRanks.filter(r => props.ranks.includes(r.id))
  const inaccessibleRankCount = props.ranks.filter(id => !props.accessibleRanks.map(r => r.id).includes(id)).length
  const inaccessibleRankString = inaccessibleRankCount === 0 ? '' : ` (and ${inaccessibleRankCount} inaccessible ranks)`
  
  if (props.ranks.length === 0) {
    return <div>--</div>
  } else {
    return <div>{whitelistedRanks.map(r => toSentenceCase(r.displayNameNoun)).join(', ')}{inaccessibleRankString}</div>
  }
}
