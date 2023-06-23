import { Clear } from '@mui/icons-material'
import { PublicRank } from '@rebel/api-models/public/rank/PublicRank'
import { toSentenceCase } from '@rebel/shared/util/text'

type Props = {
  ranks: number[]
  accessibleRanks: PublicRank[]
}

export default function RanksDisplay (props: Props) {
  const whitelistedRanks = props.accessibleRanks.filter(r => props.ranks.includes(r.id))
  const inaccessibleRankCount = props.ranks.filter(id => !props.accessibleRanks.map(r => r.id).includes(id)).length
  let inaccessibleRankString: string
  if (inaccessibleRankCount === 0) {
    inaccessibleRankString = ''
  } else if (inaccessibleRankCount === whitelistedRanks.length) {
    inaccessibleRankString = `(and ${inaccessibleRankCount} inaccessible ranks)`
  } else {
    inaccessibleRankString = `(${inaccessibleRankCount} inaccessible ranks)`
  }

  if (props.ranks.length === 0) {
    return <Clear />
  } else {
    return <div>{whitelistedRanks.map(r => toSentenceCase(r.displayNameNoun)).join(', ')}{inaccessibleRankString}</div>
  }
}
