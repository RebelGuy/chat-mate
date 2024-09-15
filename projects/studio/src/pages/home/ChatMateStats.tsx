import { Box, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { styled } from '@mui/material'
import { addTime } from '@rebel/shared/util/datetime'
import AnimatedNumber from '@rebel/studio/components/AnimatedNumber'
import ApiError from '@rebel/studio/components/ApiError'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import TextWithHelp from '@rebel/studio/components/TextWithHelp'
import useRequest from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { getChatMateStats } from '@rebel/studio/utility/api'
import { useState } from 'react'

const ANIMATION_DURATION = 2000

const Cell = styled(TableCell)(() => ({
  minWidth: 100,
  textAlign: 'center'
}))

export default function ChatMateStats () {
  const [token, onUpdateToken] = useUpdateKey()
  const [since, setSince] = useState<number | undefined>(undefined)
  const { data, isLoading, error } = useRequest(getChatMateStats(since), { updateKey: token })

  const onChangeTime = (_: any, newTime: 'lifetime' | 'today' | null) => {
    if (newTime == null) {
      // null if the selection hasn't changed (why?!)
      return
    }

    setSince(newTime === 'lifetime' ? undefined : get24HoursAgoTimestamp())
  }

  const onRefresh = () => {
    onUpdateToken()
    setSince(since == null ? since : get24HoursAgoTimestamp())
  }

  return <>
    <PanelHeader>ChatMate Stats {<RefreshButton isLoading={isLoading} onRefresh={onRefresh} />}</PanelHeader>
    <ApiError error={error} />

    <Box style={{ width: 'fit-content' }}>
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
          <Stat label="Number of website visitors" help="The number of unique users that have visited the ChatMate website." totalNumber={data?.totalVisitors ?? 0} />
          <Stat label="Number of registered users" help="The number of users that have created a free ChatMate account." totalNumber={data?.registeredUserCount ?? 0} />
          <Stat label="Number of streamers" help="The number of registered users who have signed up as a ChatMate streamer. Each streamer declares a primary streaming channel on Youtube, Twitch, or both." totalNumber={data?.streamerCount ?? 0} youtubeNumber={data?.youtubeStreamerCount ?? 0} twitchNumber={data?.twitchStreamerCount ?? 0} />
          <Stat label="Number of unique channels" help="The number of channels that have participated in livestreams connected to ChatMate." totalNumber={data?.uniqueChannelCount ?? 0} youtubeNumber={data?.uniqueYoutubeChannelCount ?? 0} twitchNumber={data?.uniqueTwitchChannelCount ?? 0} />
          <Stat label="Number of chat messages" help="The number of chat messages that have been received in livestreams connected to ChatMate." totalNumber={data?.chatMessageCount ?? 0} youtubeNumber={data?.youtubeMessageCount ?? 0} twitchNumber={data?.twitchMessageCount ?? 0} />
          <Stat label="Number of live reactions" help="The number of live reactions sent in Youtube chat." totalNumber={data?.youtubeLiveReactions ?? 0} youtubeNumber={data?.youtubeLiveReactions} />
          <Stat label="Total days livestreamed" help="The number of days ChatMate streamers have been live for. A livestream represents a continuous span of time during which a streamer was live, either on Youtube, Twitch, or both." totalNumber={data?.totalDaysLivestreamed ?? 0} youtubeNumber={data?.youtubeTotalDaysLivestreamed ?? 0} twitchNumber={data?.twitchTotalDaysLivestreamed ?? 0} decimals={3} />
          <Stat label="Total experience gained" help="The amount of experience gained by users interacting in livestreams connected to ChatMate. Experience is used for the chat levelling system." totalNumber={data?.totalExperience ?? 0} />
        </TableBody>
      </Table>
      <ToggleButtonGroup
        value={since == null ? 'lifetime' : 'today'}
        onChange={onChangeTime}
        exclusive
        sx={{ mt: 1 }}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        <ToggleButton value="lifetime">
          Lifetime stats
        </ToggleButton>
        <ToggleButton value="today">
          Today's stats
        </ToggleButton>
      </ToggleButtonGroup>

    </Box>
  </>
}

type StatProps = {
  label: string
  help: string
  totalNumber: number
  youtubeNumber?: number
  twitchNumber?: number
  decimals?: number
}

function Stat (props: StatProps) {
  return (
    <TableRow sx={{ m: 1 }}>
      <Cell style={{ textAlign: 'right' }}><TextWithHelp text={props.label} help={props.help} disableInteractive arrow /></Cell>
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

function get24HoursAgoTimestamp () {
  return addTime(new Date(), 'days', -1).getTime()
}
