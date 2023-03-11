import RequireRank from '@rebel/studio/components/RequireRank'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { PageEmojis, PageManager, PageApply, PageLink } from '@rebel/studio/pages/navigation'
import { useContext } from 'react'
import { Link, generatePath } from 'react-router-dom'

export default function Navigation () {
  const loginContext = useContext(LoginContext)

  const isLoggedIn = loginContext.username != null

  return (
    <nav>
      <ul>
        {/* todo: instead of hiding navigation items when not logged in/not selected a streamer, gray them out. need to make custom component and do some css magic */}
        <li><Link to={generatePath('/')}>Home</Link></li>
        {isLoggedIn && loginContext.streamer != null && <li><Link to={generatePath(PageEmojis.path, { streamer: loginContext.streamer })}>{PageEmojis.title}</Link></li>}
        <RequireRank owner>
          <li><Link to={PageManager.path}>{PageManager.title}</Link></li>
        </RequireRank>
        <RequireRank admin>
          <li><Link to={PageApply.path}>{PageApply.title}</Link></li>
        </RequireRank>
        {isLoggedIn && <li><Link to={PageLink.path}>{PageLink.title}</Link></li>}
      </ul>
    </nav>
  )
}