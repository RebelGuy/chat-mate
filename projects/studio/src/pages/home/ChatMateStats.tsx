import { Box } from '@mui/material'
import AnimatedNumber from '@rebel/studio/components/AnimatedNumber'
import PanelHeader from '@rebel/studio/components/PanelHeader'
import RefreshButton from '@rebel/studio/components/RefreshButton'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { ReactElement } from 'react'

const ANIMATION_DURATION = 2000

export default function ChatMateStats () {
  const [token, onRefresh] = useUpdateKey()

  return <>
    <PanelHeader>ChatMate Stats {<RefreshButton isLoading={false} onRefresh={onRefresh} />}</PanelHeader>
    <Stat label="Number of streamers" number={1} />
    <Stat label="Number of registered users" number={1} />
    <Stat label="Number of unique channels" number={1} />
    <Stat label="Number of messages sent" number={1} />
    <Stat label="Total experience gained" number={1} />
    <Stat label="Total days livestreamed" number={1} />
  </>
}

type StatProps = {
  label: string
  number?: number | null
}

function Stat (props: StatProps) {
  const contents = (num: number) => (
    <StatWrapper>
      <>{props.label}: {num}</>
    </StatWrapper>
  )

  if (props.number == null) {
    return contents(0)
  } else {
    return (
      <StatWrapper>
        <AnimatedNumber initial={0} target={props.number} duration={ANIMATION_DURATION}>
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
