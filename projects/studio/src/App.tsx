import { LoginProvider } from '@rebel/studio/contexts/LoginContext'
import { Route, Routes } from 'react-router-dom'
import MainView from '@rebel/studio/pages/main/MainView'
import { pages } from '@rebel/studio/pages/navigation'

export default function App () {
  return (
    <LoginProvider>
      <Routes>
        <Route path="/" element={<MainView />}>
          {pages.map(page => 
            <Route key={page.id} path={page.path} element={page.element} />
          )}
        </Route>
      </Routes>
    </LoginProvider>
  )
}
