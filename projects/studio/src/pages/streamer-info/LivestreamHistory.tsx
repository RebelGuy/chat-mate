import { Expand, ExpandLess, ExpandMore } from '@mui/icons-material'
import { Table, TableHead, TableRow, TableCell, TableBody, styled, Tooltip, Box, IconButton, Collapse } from '@mui/material'
import { PublicAggregateLivestream } from '@rebel/api-models/public/livestream/PublicAggregateLivestream'
import { PublicLivestream } from '@rebel/api-models/public/livestream/PublicLivestream'
import { sortBy } from '@rebel/shared/util/arrays'
import { getNumericElapsedHoursText } from '@rebel/shared/util/datetime'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'
import Twitch from '@rebel/studio/icons/Twitch'
import YouTube from '@rebel/studio/icons/YouTube'
import { useState } from 'react'

const HeaderCell = styled(TableCell)(() => ({
  minWidth: 100,
  textAlign: 'center'
}))

const BodyCell = styled(TableCell)(() => ({
  minWidth: 100,
  textAlign: 'center'
}))

const ExpandBox = styled(Box)(({ theme }) => ({
  height: theme.spacing(3),
  color: theme.palette.text.secondary
}))

const AdditionalLivestreamsContainer = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(1)
}))

type Props = {
  livestreams: PublicAggregateLivestream[]
}

export default function LivestreamHistory (props: Props) {
  const [expanded, setExpanded] = useState<number[]>([])

  function toggleExpandState (aggregateLivestream: PublicAggregateLivestream) {
    const key = aggregateLivestream.startTime // we can assume this is unique

    if (expanded.includes(key)) {
      setExpanded(expanded.filter(x => x !== key))
    } else {
      setExpanded([...expanded, key])
    }
  }

  function isExpanded (aggregateLivestream: PublicAggregateLivestream) {
    return expanded.includes(aggregateLivestream.startTime)
  }

  if (props.livestreams.length === 0) {
    return null
  }

  return <>
    Past livestreams:
    <Table size="small" style={{ width: 'unset' }}>
      <TableHead>
        <TableRow>
          <HeaderCell>Date</HeaderCell>
          <HeaderCell>Duration</HeaderCell>
          <HeaderCell>Platform</HeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {sortBy(props.livestreams, l => l.startTime, 'desc').map((aggregateLivestream, i) => {
          const singleLivestream = aggregateLivestream.livestreams.length === 1
          const showDetails = isExpanded(aggregateLivestream)
          const livestreams = sortBy(aggregateLivestream.livestreams, l => l.startTime ?? 0, 'desc')

          return (
            <TableRow key={i}>
              <BodyCell>
                <Box>{new Date(aggregateLivestream.startTime).toLocaleString()}</Box>
                <Collapse in={showDetails}>
                  <AdditionalLivestreamsContainer>
                    {livestreams.map((livestream, j) => (
                      <ExpandBox key={j}>
                        {livestream.startTime != null ? new Date(livestream.startTime).toLocaleString() : 'Not started'}
                      </ExpandBox>
                    ))}
                  </AdditionalLivestreamsContainer>
                </Collapse>
              </BodyCell>
              <BodyCell>
                <Box>{aggregateLivestream.endTime == null ? 'In progress' : getNumericElapsedHoursText(aggregateLivestream.endTime - aggregateLivestream.startTime)}</Box>
                <Collapse in={showDetails}>
                  <AdditionalLivestreamsContainer>
                    {livestreams.map((livestream, j) => (
                      <ExpandBox key={j}>
                        {livestream.startTime != null && livestream.endTime != null
                          ? getNumericElapsedHoursText(livestream.endTime - livestream.startTime)
                          : livestream.startTime == null ? 'Not started' : 'In progress'
                        }
                      </ExpandBox>
                    ))}
                  </AdditionalLivestreamsContainer>
                </Collapse>
              </BodyCell>
              <BodyCell>
                <Box>
                  {singleLivestream
                    ? <PlatformIcon livestream={livestreams[0]} />
                    : <Box position="relative">
                      <IconButton onClick={() => toggleExpandState(aggregateLivestream)} sx={{ p: 0.5, m: -0.5 }}>{showDetails ? <ExpandLess /> : <ExpandMore />}</IconButton>
                      <Box position="absolute" display="inline" pl={0.5}>
                        {`(${livestreams.length})`}
                      </Box>
                    </Box>
                  }
                </Box>
                <Collapse in={showDetails}>
                  {livestreams.map((livestream, j) => (
                    <ExpandBox key={j}>
                      <PlatformIcon livestream={livestream} />
                    </ExpandBox>
                  ))}
                </Collapse>
              </BodyCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  </>
}

type PlatformIconProps = {
  livestream: PublicLivestream
}

function PlatformIcon (props: PlatformIconProps) {
  if (props.livestream.platform === 'youtube') {
    return (
      <Tooltip title="View livestream" placement="right">
        <Box display="inline">
          <LinkInNewTab href={props.livestream.livestreamLink}>
            <IconButton sx={{ p: 0.5, m: -0.5 }}>
              <YouTube htmlColor="red" />
            </IconButton>
          </LinkInNewTab>
        </Box>
      </Tooltip>
    )
  } else if (props.livestream.platform === 'twitch') {
    return <Twitch htmlColor="#6441A5" />
  } else {
    assertUnreachable(props.livestream.platform)
  }
}
