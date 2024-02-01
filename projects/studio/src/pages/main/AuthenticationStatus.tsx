import { getMasterchatAuthentication } from '@rebel/studio/utility/api'
import useRequest from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'
import { addTime } from '@rebel/shared/util/datetime'
import RelativeTime from '@rebel/studio/components/RelativeTime'
import { Box, SxProps } from '@mui/material'

const REFRESHING_INTERVAL = 28 * 24 * 3600 * 1000
const WARNING_THRESHOLD = 7 * 24 * 3600 * 1000

export default function AuthenticationStatus () {
  const [key] = useUpdateKey({ repeatInterval: 5000 })
  const { data } = useRequest(getMasterchatAuthentication(), { updateKey: key })

  // if the masterchat instance needs to be refreshed soon, show a warning appearance
  let sxProps: SxProps | undefined = undefined
  if (data?.lastUpdatedTimestamp != null && data.lastUpdatedTimestamp + REFRESHING_INTERVAL - Date.now() < WARNING_THRESHOLD) {
    sxProps = { fontWeight: 1000, color: 'orange' }
  }

  return <Box sx={sxProps}>
    <div style={{ display: 'inline' }}>Masterchat authenticated: </div>
    <div style={{ display: 'inline', color: data?.authenticated ? 'green' : 'red' }}>
      {data?.authenticated != null ? String(data?.authenticated) : 'unknown'}
      {data?.lastUpdatedTimestamp != null && <RelativeTime time={data.lastUpdatedTimestamp} prefix=" (" suffix=" ago)" />}
    </div>
  </Box>
}
