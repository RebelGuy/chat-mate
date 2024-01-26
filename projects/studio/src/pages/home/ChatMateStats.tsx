import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { styled } from '@mui/material'
import AnimatedNumber from '@rebel/studio/components/AnimatedNumber'
import ApiError from '@rebel/studio/components/ApiError'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import useRequest from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { getChatMateStats } from '@rebel/studio/utility/api'

const ANIMATION_DURATION = 2000

const Cell = styled(TableCell)(() => ({
  minWidth: 100,
  textAlign: 'center'
}))

export default function ChatMateStats () {
  const [token, onRefresh] = useUpdateKey()
  const { data, isLoading, error } = useRequest(getChatMateStats(), { updateKey: token })

  return <>
    <PanelHeader>ChatMate Stats {<RefreshButton isLoading={isLoading} onRefresh={onRefresh} />}</PanelHeader>
    <ApiError error={error} />
    <Table size="small" style={{ width: 'unset' }}>
      <TableHead>
        <TableRow>
          <TableCell></TableCell>
          <Cell>Total</Cell>
          <Cell>Youtube</Cell>
          <Cell>Twitch</Cell>
        </TableRow>
      </TableHead>
      <TableBody>
        <Stat label="Number of registered users" totalNumber={data?.registeredUserCount ?? 0} />
        <Stat label="Number of streamers" totalNumber={data?.streamerCount ?? 0} youtubeNumber={data?.youtubeStreamerCount ?? 0} twitchNumber={data?.twitchStreamerCount ?? 0} />
        <Stat label="Number of unique channels" totalNumber={data?.uniqueChannelCount ?? 0} youtubeNumber={data?.uniqueYoutubeChannelCount ?? 0} twitchNumber={data?.uniqueTwitchChannelCount ?? 0} />
        <Stat label="Number of chat messages" totalNumber={data?.chatMessageCount ?? 0} youtubeNumber={data?.youtubeMessageCount ?? 0} twitchNumber={data?.twitchMessageCount ?? 0} />
        <Stat label="Total days livestreamed" totalNumber={data?.totalDaysLivestreamed ?? 0} youtubeNumber={data?.youtubeTotalDaysLivestreamed ?? 0} twitchNumber={data?.twitchTotalDaysLivestreamed ?? 0} decimals={3} />
        <Stat label="Total experience gained" totalNumber={data?.totalExperience ?? 0} />
      </TableBody>
    </Table>
  </>
}

type StatProps = {
  label: string
  totalNumber: number
  youtubeNumber?: number
  twitchNumber?: number
  decimals?: number
}

function Stat (props: StatProps) {
  return (
    <TableRow sx={{ m: 1 }}>
      <Cell style={{ textAlign: 'right' }}>{props.label}</Cell>
      <Cell><Number target={props.totalNumber} decimals={props.decimals} /></Cell>
      <Cell><Number target={props.youtubeNumber} decimals={props.decimals} /></Cell>
      <Cell><Number target={props.twitchNumber} decimals={props.decimals} /></Cell>
    </TableRow>
  )
}

function Number (props: { target: number | undefined, decimals: number | undefined }) {
  if (props.target == null) {
    return null
  }

  return (
    <AnimatedNumber initial={0} target={props.target} duration={ANIMATION_DURATION} decimals={props.decimals} smoothVelocity>
      {(num: number) => <>{num.toLocaleString()}</>}
    </AnimatedNumber>
  )
}
