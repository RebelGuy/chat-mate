import { Alert, Avatar, Box, Button } from '@mui/material'
import ApiError from '@rebel/studio/components/ApiError'
import ApiRequestTrigger from '@rebel/studio/components/ApiRequestTrigger'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import useRequest from '@rebel/studio/hooks/useRequest'
import { PageLogin } from '@rebel/studio/pages/navigation'
import { logout } from '@rebel/studio/utility/api'
import React from 'react'
import { useContext } from 'react'
import { useNavigate, generatePath } from 'react-router-dom'

export default function UserInfo () {
  const loginContext = useContext(LoginContext)
  const navigate = useNavigate()

  const isLoggedIn = loginContext.username != null
  if (!isLoggedIn) {
    return <>
      <Alert severity="info">
        You are not currently logged in.
      </Alert>
      <Button onClick={() => navigate(generatePath(PageLogin.path))} fullWidth sx={{ marginTop: 1, marginBottom: 1}}>Login</Button>

      {loginContext.authError != null && <>
        <Alert severity="error">{loginContext.authError}</Alert>
      </>}
    </>
  }

  return <>
    <Avatar sx={{ margin: 'auto' }} />
    <Box sx={{ textAlign: 'center' }}> Hi, <b>{loginContext.username}</b>! </Box>
    <LogoutButton />
  </>
}

function LogoutButton () {
  const loginContext = React.useContext(LoginContext)
  const navigate = useNavigate()
  const logoutRequest = useRequest(logout(), { onDemand: true, onSuccess: onDone, onError: onDone })

  function onDone () {
    loginContext.logout()
    navigate(generatePath('/'))
  }

  return (
    <>
      <Button disabled={logoutRequest.isLoading} onClick={logoutRequest.triggerRequest} sx={{ display: 'block', margin: 'auto' }}>Logout</Button>
    </>
  )
}
