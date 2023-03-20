import { Box } from '@mui/system'
import LoginContext, { RankName } from '@rebel/studio/contexts/LoginContext'
import { useContext } from 'react'

type Props = {
  children: React.ReactElement
  forbidden?: React.ReactElement
  inverted?: boolean
  adminsCanBypass?: boolean
  hideAdminOutline?: boolean

  // is an owner on one streamer, regardless of the current streamer context
  anyOwner?: boolean
} & { [name in RankName]?: boolean }

export default function RequireRank (props: Props) {
  const loginContext = useContext(LoginContext)

  const requiredRanks = (Object.keys(props) as (keyof Props)[]).filter(key =>
    key !== 'children'
    && key !== 'forbidden'
    && key !== 'inverted'
    && key !== 'adminsCanBypass'
    && key !== 'anyOwner'
    && props[key] === true
  ) as RankName[]
  let hasAnyRequiredRank = requiredRanks.find(rank => loginContext.hasRank(rank)) != null

  if (props.anyOwner && loginContext.isStreamer) {
    hasAnyRequiredRank = true
  }

  if (props.inverted) {
    hasAnyRequiredRank = !hasAnyRequiredRank
  }

  if (props.adminsCanBypass && loginContext.hasRank('admin')) {
    hasAnyRequiredRank = true
  }

  if (loginContext.loginToken != null && hasAnyRequiredRank) {
    if (props.admin && props.hideAdminOutline !== true) {
      return (
        <Box sx={{ border: '2px red dashed' }}>
          {props.children}
        </Box>
      )
    } else {
      return props.children
    }
  } else {
    return props.forbidden ?? null
  }
}
