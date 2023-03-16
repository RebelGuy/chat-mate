import { Box, Checkbox, FormControlLabel } from '@mui/material'
import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import { toSentenceCase } from '@rebel/shared/util/text'

type Props = {
  disabled: boolean
  ranks: number[]
  accessibleRanks: PublicRank[]
  onChange: (newRanks: number[]) => void
}

export default function RanksSelector (props: Props) {
  const inaccessibleRankCount = props.ranks.filter(id => !props.accessibleRanks.map(r => r.id).includes(id)).length
  const inaccessibleRankString = inaccessibleRankCount === 0 ? '' : ` (and ${inaccessibleRankCount} inaccessible ranks)`

  const toggleCheckbox = (rankId: number) => {
    let ranks = props.ranks
    if (ranks.includes(rankId)) {
      ranks = ranks.filter(r => r !== rankId)
    } else {
      ranks.push(rankId)
    }
    props.onChange(ranks)
  }

  return (
    <Box sx={{ p: 1 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          columnGap: 2,
          rowGap: 2
        }}
      >
        {props.accessibleRanks.map(r => (
          <FormControlLabel
            key={r.id}
            label={toSentenceCase(r.displayNameNoun)}
            control={
              <Checkbox
                checked={props.ranks.includes(r.id)}
                disabled={props.disabled}
                onChange={() => toggleCheckbox(r.id)}
                sx={{ p: 0 }}
              />
            }
          />
        ))}
      </Box>
      {inaccessibleRankString}
    </Box>
  )
}
