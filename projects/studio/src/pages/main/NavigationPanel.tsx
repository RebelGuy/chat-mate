import { Box } from '@mui/material'
import CentredLoadingSpinner from '@rebel/studio/components/CentredLoadingSpinner'
import RequireRank from '@rebel/studio/components/RequireRank'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { PageEmojis, PageManager, PageApply, PageLink, PageHome, Page, PageTwitchAuth } from '@rebel/studio/pages/navigation'
import { PathParam } from '@rebel/studio/utility/types'
import { cloneElement, useContext } from 'react'
import { Link, generatePath, useLocation, matchPath } from 'react-router-dom'

export default function Navigation () {
  const loginContext = useContext(LoginContext)

  if (!loginContext.isHydrated) {
    return <CentredLoadingSpinner />
  }

  const isLoggedIn = loginContext.username != null

  return (
    <nav>
      {/* todo: instead of hiding navigation items when not logged in/not selected a streamer, gray them out. need to make custom component and do some css magic */}
      <NavItem page={PageHome} />
      {isLoggedIn && loginContext.streamer != null && <NavItem page={PageEmojis} streamer={loginContext.streamer} />}
      <NavItem page={PageManager} />
      <NavItem page={PageApply} />
      <NavItem page={PageTwitchAuth} />
      {isLoggedIn && <NavItem page={PageLink} />}
    </nav>
  )
}

type NavItemProps<P extends Page> = {
  page: P
} & {
  // path params are dynamically calculated and required as separate props to the component
  //   :    -------      ))
  [key in PathParam<P['path']>]: string | null
}

function NavItem<P extends Page> ({ page, ...params }: NavItemProps<P>) {
  const loginContext = useContext(LoginContext)
  const { pathname: currentPath } = useLocation()
  const isSelected = matchPath({ path: page.path }, currentPath)

  const path = generatePath(page.path, params)

  if (!loginContext.isHydrated) {
    return null
  }

  const content = (
    <Box sx={{ m: 0.5 }}>
      <Link to={path} style={{ color: 'black', textDecoration: 'none' }}>
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
      </Link>
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
