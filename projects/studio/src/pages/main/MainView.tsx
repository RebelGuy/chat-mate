import RequireRank from '@rebel/studio/components/RequireRank'
import RouteParamsObserver from '@rebel/studio/components/RouteParamsObserver'
import DebugInfo from '@rebel/studio/pages/main/DebugInfo'
import { Outlet } from 'react-router-dom'
import { Box, Container, Typography } from '@mui/material'
import NavigationPanel from '@rebel/studio/pages/main/NavigationPanel'
import UserPanel from '@rebel/studio/pages/main/UserPanel'
import styled from '@emotion/styled'
import { useContext, useState } from 'react'
import LoginContext from '@rebel/studio/contexts/LoginContext'

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

  return (
    <Box sx={{ overflow: 'hidden', height: '100vh', display: 'flex', flexDirection: 'column', typography: 'body1' }}>
      {/* header */}
      <Typography variant="h3" style={{ fontWeight: 500, margin: 'auto' }} ref={node => setHeaderHeight(node?.clientHeight ?? 0)}>ChatMate</Typography>

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
            <Box sx={{ m: 1 }}>
              {!loginContext.isLoading && loginContext.initialised &&
                // placeholder component for the page that is currently selected
                <Outlet />
              }
            </Box>
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

// todo: auth flow: https://github.com/remix-run/react-router/blob/dev/examples/auth/src/App.tsx
