import CentredLoadingSpinner from '@rebel/studio/components/CentredLoadingSpinner'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import SelectStreamer from '@rebel/studio/pages/main/SelectStreamer'
import UserInfo from '@rebel/studio/pages/main/UserInfo'
import { useContext } from 'react'

export default function UserPanel () {
  const loginContext = useContext(LoginContext)

  if (loginContext.username == null) {
    return <UserInfo />
  }

  if (!loginContext.isHydrated && loginContext.isLoading) {
    return <CentredLoadingSpinner />
  }

  return (
    <>
      <UserInfo />
      <SelectStreamer />
    </>
  )
}
