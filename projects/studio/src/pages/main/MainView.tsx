import RequireRank from '@rebel/studio/components/RequireRank'
import RouteParamsObserver from '@rebel/studio/components/RouteParamsObserver'
import DebugInfo from '@rebel/studio/pages/main/DebugInfo'
import { Outlet } from 'react-router-dom'
import { Container, Typography } from '@mui/material'
import NavigationPanel from '@rebel/studio/pages/main/NavigationPanel'
import UserPanel from '@rebel/studio/pages/main/UserPanel'
import styled from '@emotion/styled'

const Panel = styled('div')({
  border: '1px solid rgba(0, 0, 0, 0.1)',
  borderRadius: 12,
  padding: 4,
  boxShadow: '3px 3px 5px rgba(0, 0, 0, 0.1)'
})

export default function MainView () {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <Typography variant='h2' style={{ fontWeight: 500, margin: 'auto' }}>ChatMate</Typography>

      {/* body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
        <Container sx={{ flex: 1, minWidth: 250 }}>
          <Panel style={{ height: 'calc(50% - 20px)', marginBottom: 20 }}>
            <NavigationPanel />
          </Panel>
          <Panel style={{ height: 'calc(50% - 20px)' }}>
            <UserPanel />
          </Panel>
        </Container>

        <Container sx={{ minWidth: 300 }}>
          <Panel>
            {/* placeholder component for the page that is currently selected */}
            <Outlet />
          </Panel>
        </Container>
      </div>

      {/* footer */}
      <div style={{ width: '100%', bottom: 8, textAlign: 'center' }}>
        <em style={{ fontSize: 14 }}>This is a work in progress...</em>
      </div>

      {/* special */}
      <RouteParamsObserver />
      <RequireRank admin>
        <DebugInfo />
      </RequireRank>
    </div>
  )
}

// todo: auth flow: https://github.com/remix-run/react-router/blob/dev/examples/auth/src/App.tsx
