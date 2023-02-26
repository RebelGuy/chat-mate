import { Avatar, Button, Typography } from '@mui/material'
import ApiRequestTrigger from '@rebel/studio/components/ApiRequestTrigger'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { logout } from '@rebel/studio/utility/api'
import React from 'react'
import { useContext } from 'react'
import { useNavigate, generatePath } from 'react-router-dom'

export default function UserInfo () {
  const loginContext = useContext(LoginContext)

  const isLoggedIn = loginContext.username != null
  if (!isLoggedIn) {
    return null
  }

  return <>
    <Avatar sx={{ margin: 'auto' }} />
    <Typography sx={{ textAlign: 'center' }}> Hi, <b>{loginContext.username}</b>! </Typography>
    <LogoutButton />
  </>
}

function LogoutButton () {
  const loginContext = React.useContext(LoginContext)
  const navigate = useNavigate()

  const onLogout = async (loginToken: string) => {
    const result = await logout(loginToken)
    loginContext.logout()
    navigate(generatePath('/'))
    return result
  }

  return (
    <ApiRequestTrigger onRequest={onLogout}>
      {(onMakeRequest, responseData, loadingNode, errorNode) => (
        <>
          <Button disabled={loadingNode != null} onClick={onMakeRequest} sx={{ display: 'block', margin: 'auto' }}>Logout</Button>
          {errorNode}
        </>
      )}
    </ApiRequestTrigger>
  )
}
