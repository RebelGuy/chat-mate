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
                defaultChecked={false}
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
