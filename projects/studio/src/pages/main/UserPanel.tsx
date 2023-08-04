import { Box } from '@mui/material'
import CentredLoadingSpinner from '@rebel/studio/components/CentredLoadingSpinner'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import SelectStreamer from '@rebel/studio/pages/main/SelectStreamer'
import Socials from '@rebel/studio/pages/main/Socials'
import UserInfo from '@rebel/studio/pages/main/UserInfo'
import { ReactElement, useContext } from 'react'

export default function UserPanel () {
  const loginContext = useContext(LoginContext)

  let content: ReactElement
  if (loginContext.username == null) {
    content = <>
      <UserInfo />
      <SelectStreamer />
    </>
  } else if (!loginContext.isHydrated && loginContext.isLoading) {
    // i can't work out how to centre it vertically, but this looks ok
    content = <Box style={{ marginTop: '50%' }}>
      <CentredLoadingSpinner />
    </Box>
  } else {
    content = <>
      <UserInfo />
      <SelectStreamer />
    </>
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%', justifyContent: 'space-between' }}>
      <Box sx={{ flex: 1 }}>{content}</Box>
      <Box sx={{ alignSelf: 'flex-end', width: '100%' }}><Socials /></Box>
    </Box>
  )
}
