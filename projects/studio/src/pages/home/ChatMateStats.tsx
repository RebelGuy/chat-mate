import { Box } from '@mui/material'
import AnimatedNumber from '@rebel/studio/components/AnimatedNumber'
import ApiError from '@rebel/studio/components/ApiError'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import useRequest from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { getChatMateStats } from '@rebel/studio/utility/api'
import { ReactElement } from 'react'

const ANIMATION_DURATION = 2000

export default function ChatMateStats () {
  const [token, onRefresh] = useUpdateKey()
  const { data, isLoading, error } = useRequest(getChatMateStats(), { updateKey: token })

  return <>
    <PanelHeader>ChatMate Stats {<RefreshButton isLoading={isLoading} onRefresh={onRefresh} />}</PanelHeader>
    <ApiError error={error} />
    <Stat label="Number of streamers" number={data?.streamerCount ?? 0} />
    <Stat label="Number of registered users" number={data?.registeredUserCount ?? 0} />
    <Stat label="Number of unique channels" number={data?.uniqueChannelCount ?? 0} />
    <Stat label="Number of messages sent" number={data?.chatMessageCount ?? 0} />
    <Stat label="Total experience gained" number={data?.totalExperience ?? 0} />
    <Stat label="Total days livestreamed" number={data?.totalDaysLivestreamed ?? 0} decimals={3} />
  </>
}

type StatProps = {
  label: string
  number?: number | null
  decimals?: number
}

function Stat (props: StatProps) {
  const contents = (num: number) => (
    <StatWrapper>
      <>{props.label}: {num.toLocaleString()}</>
    </StatWrapper>
  )

  if (props.number == null) {
    return contents(0)
  } else {
    return (
      <StatWrapper>
        <AnimatedNumber initial={0} target={props.number} duration={ANIMATION_DURATION} decimals={props.decimals}>
          {contents}
        </AnimatedNumber>
      </StatWrapper>
    )
  }
}

function StatWrapper (props: { children: ReactElement }) {
  return (
    <Box sx={{ m: 1 }}>
      {props.children}
    </Box>
  )
}
