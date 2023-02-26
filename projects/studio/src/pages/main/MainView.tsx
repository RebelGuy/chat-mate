import RequireRank from '@rebel/studio/components/RequireRank'
import RouteParamsObserver from '@rebel/studio/components/RouteParamsObserver'
import DebugInfo from '@rebel/studio/pages/main/DebugInfo'
import SelectStreamer from '@rebel/studio/pages/main/SelectStreamer'
import { Outlet } from 'react-router-dom'
import { Container, Typography } from '@mui/material'
import Navigation from '@rebel/studio/pages/main/Navigation'
import UserInfo from '@rebel/studio/pages/main/UserInfo'

export default function MainView () {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <Typography variant='h2' style={{ fontWeight: 500, margin: 'auto' }}>ChatMate</Typography>

      {/* body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
        <Container sx={{ flex: 1, minWidth: 250 }}>
          <Navigation />
        </Container>

        <Container sx={{ minWidth: 300 }}>
          {/* placeholder component for the page that is currently selected */}
          <Outlet />
        </Container>

        <Container sx={{ flex: 1, minWidth: 250 }}>
          <UserInfo />
          <SelectStreamer />
        </Container>
      </div>

      {/* footer */}
      <div style={{ width: '100%', bottom: 8 }}>
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
