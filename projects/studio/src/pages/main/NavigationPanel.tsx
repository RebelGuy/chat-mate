import { Box } from '@mui/material'
import CentredLoadingSpinner from '@rebel/studio/components/CentredLoadingSpinner'
import LinkToPage, { PageProps } from '@rebel/studio/components/LinkToPage'
import RequireRank from '@rebel/studio/components/RequireRank'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { PageEmojis, PageManager, PageApply, PageLink, PageHome, Page, PageTwitchAuth, PageStreamerInfo, PageYoutubeAuth } from '@rebel/studio/pages/navigation'
import { cloneElement, useContext } from 'react'
import { useLocation, matchPath } from 'react-router-dom'

export default function Navigation () {
  const loginContext = useContext(LoginContext)

  if (!loginContext.isHydrated && loginContext.isLoading) {
    return <CentredLoadingSpinner />
  }

  return (
    <nav>
      {/* todo: instead of hiding navigation items when not logged in/not selected a streamer, gray them out. need to make custom component and do some css magic */}
      <NavItem page={PageHome} />
      <NavItem page={PageEmojis} streamer={loginContext.streamer} />
      <NavItem page={PageStreamerInfo} streamer={loginContext.streamer} />
      <NavItem page={PageManager} />
      <NavItem page={PageApply} />
      <NavItem page={PageTwitchAuth} />
      <NavItem page={PageYoutubeAuth} />
      <NavItem page={PageLink} />
    </nav>
  )
}

function NavItem<P extends Page> (props: PageProps<P>) {
  const loginContext = useContext(LoginContext)
  const { pathname: currentPath } = useLocation()

  const page = props.page
  if (!loginContext.isHydrated && page.requireRanksProps != null ||
    loginContext.username == null && page.requiresLogin ||
    loginContext.streamer == null && page.requiresStreamer
  ) {
    return null
  }

  const isSelected = matchPath({ path: page.path }, currentPath)

  const content = (
    <Box sx={{ m: 0.5 }}>
      <LinkToPage style={{ color: 'black', textDecoration: 'none' }} {...props}>
        <Box sx={{
          padding: 1,
          backgroundColor: 'rgba(0, 0, 255, 0.1)',
          borderRadius: 2,
          border: `1px ${isSelected != null ? 'red' : 'transparent'} solid`,
          display: 'flex',
          flexDirection: 'row',
          verticalAlign: 'middle',
          ':hover': {
            backgroundColor: 'rgba(0, 0, 255, 0.05)'
          }
        }}>
          {cloneElement(page.icon, { sx: { pr: 0.5 }})}
          <div style={{ marginTop: 1 }}>{page.title}</div>
        </Box>
      </LinkToPage>
    </Box>
  )

  if (page.requireRanksProps == null) {
    return content
  } else {
    return (
      <RequireRank {...page.requireRanksProps}>
        {content}
      </RequireRank>
    )
  }
}
