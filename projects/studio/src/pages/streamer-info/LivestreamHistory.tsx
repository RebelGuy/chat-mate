import { Table, TableHead, TableRow, TableCell, TableBody, styled, Tooltip, Box, IconButton } from '@mui/material'
import { PublicAggregateLivestream } from '@rebel/api-models/public/livestream/PublicAggregateLivestream'
import { PublicLivestream } from '@rebel/api-models/public/livestream/PublicLivestream'
import { sortBy } from '@rebel/shared/util/arrays'
import { getNumericElapsedHoursText } from '@rebel/shared/util/datetime'
import { assertUnreachable } from '@rebel/shared/util/typescript'
import LinkInNewTab from '@rebel/studio/components/LinkInNewTab'
import Twitch from '@rebel/studio/icons/Twitch'
import YouTube from '@rebel/studio/icons/YouTube'

const HeaderCell = styled(TableCell)(() => ({
  minWidth: 100,
  textAlign: 'center'
}))

const BodyCell = styled(TableCell)(() => ({
  minWidth: 100,
  textAlign: 'center'
}))

type Props = {
  livestreams: PublicAggregateLivestream[]
}

export default function LivestreamHistory (props: Props) {
  if (props.livestreams.length === 0) {
    return null
  }

  const showYoutubeUrl = props.livestreams.some(aggregateLivestream => aggregateLivestream.livestreams.some(livestream => livestream.platform === 'youtube'))
  const showTwitchIcon = props.livestreams.some(aggregateLivestream => aggregateLivestream.livestreams.some(livestream => livestream.platform === 'twitch'))

  return <>
    Past livestreams:
    <Table size="small" style={{ width: 'unset' }}>
      <TableHead>
        <TableRow>
          <HeaderCell>Date</HeaderCell>
          <HeaderCell>Duration</HeaderCell>
          <HeaderCell>Platform</HeaderCell>
          {showYoutubeUrl && <HeaderCell></HeaderCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {sortBy(props.livestreams, l => l.startTime, 'desc').map((aggregateLivestream, i) => (
          <TableRow key={i}>
            <BodyCell>{new Date(aggregateLivestream.startTime).toLocaleString()}</BodyCell>
            <BodyCell>{aggregateLivestream.endTime == null ? 'In progress' : getNumericElapsedHoursText(aggregateLivestream.endTime - aggregateLivestream.startTime)}</BodyCell>
            <BodyCell>{aggregateLivestream.livestreams.length === 1 ? <PlatformIcon livestream={aggregateLivestream.livestreams[0]} /> : null}</BodyCell>
          </TableRow>
        ))}
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
