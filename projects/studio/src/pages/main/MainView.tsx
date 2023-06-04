import RequireRank from '@rebel/studio/components/RequireRank'
import RouteParamsObserver from '@rebel/studio/components/RouteParamsObserver'
import DebugInfo from '@rebel/studio/pages/main/DebugInfo'
import { Outlet } from 'react-router-dom'
import { Alert, Box, Container, Typography } from '@mui/material'
import NavigationPanel from '@rebel/studio/pages/main/NavigationPanel'
import UserPanel from '@rebel/studio/pages/main/UserPanel'
import styled from '@emotion/styled'
import { ReactNode, useContext, useState } from 'react'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import useRequest from '@rebel/studio/hooks/useRequest'
import { getAdministrativeMode } from '@rebel/studio/utility/api'
import useCurrentPage from '@rebel/studio/hooks/useCurrentPage'
import CentredLoadingSpinner from '@rebel/studio/components/CentredLoadingSpinner'

const Panel = styled('div')({
  border: '1px solid rgba(0, 0, 0, 0.1)',
  borderRadius: 12,
  padding: 4,
  boxShadow: '3px 3px 5px rgba(0, 0, 0, 0.1)',
  overflow: 'auto'
})

export default function MainView () {
  const [headerHeight, setHeaderHeight] = useState(0)
  const loginContext = useContext(LoginContext)
  const getAdministrativeModeRequest = useRequest(getAdministrativeMode(), {
    // normally we don't need to do this, but the MainView renders before login info is completely loaded in and we need to trigger a re-request once it has finished loading
    updateKey: loginContext.isHydrated,
    onRequest: () => !loginContext.hasRank('admin')
  })

  const isAdministrativeMode = getAdministrativeModeRequest.data?.isAdministrativeMode === true

  return (
    <Box sx={{ overflow: 'hidden', height: '100vh', display: 'flex', flexDirection: 'column', typography: 'body1' }}>
      {/* header */}
      <Typography variant="h3" style={{ fontWeight: 500, margin: 'auto', color: isAdministrativeMode ? 'red' : undefined }} ref={node => setHeaderHeight(node?.clientHeight ?? 0)}>
        ChatMate{isAdministrativeMode ? ' (Administrative Mode)' : ''}
      </Typography>

      {/* body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
        <Container style={{ flex: '1 0 250px', paddingRight: 0 }}>
          <Panel style={{ height: 'calc(50% - 20px)', marginBottom: 20 }}>
            <NavigationPanel />
          </Panel>
          <Panel style={{ height: 'calc(50% - 15px)' }}>
            <UserPanel />
          </Panel>
        </Container>

        <Container style={{ minWidth: 300, maxWidth: 10000, maxHeight: `calc(100vh - ${headerHeight}px - 30px)` }}>
          <Panel style={{ height: '100%' }}>
            <CurrentPage />
          </Panel>
        </Container>
      </div>

      {/* footer */}
      <div style={{ width: '100%', bottom: 8, textAlign: 'center' }}>
        <em style={{ fontSize: 14 }}>This is a work in progress...</em>
      </div>

      {/* special */}
      <RouteParamsObserver />
      <RequireRank admin hideAdminOutline>
        <DebugInfo />
      </RequireRank>
    </Box>
  )
}

function CurrentPage () {
  const loginContext = useContext(LoginContext)
  const page = useCurrentPage()

  if (loginContext.isLoading && !loginContext.isHydrated) {
    return <CentredLoadingSpinner />
  } else if (page?.requiresStreamer && loginContext.streamer == null) {
    // the user already gets redirected to Home in the SelectStreamer component
    return null
  }

  let content: ReactNode
  if (page == null || page.requireRanksProps == null) {
    content = <Outlet />
  } else {
    content = (
      <RequireRank
        hideAdminOutline
        forbidden={<Alert severity="error">You do not have permission to access this page.</Alert>}
        {...page.requireRanksProps}
      >
        <Outlet />
      </RequireRank>
    )
  }

  return (
    <Box sx={{ m: 1 }}>
      {content}
    </Box>
  )
}

// todo: auth flow: https://github.com/remix-run/react-router/blob/dev/examples/auth/src/App.tsx
