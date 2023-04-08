import { Page, pages } from '@rebel/studio/pages/navigation'
import { useMemo } from 'react'
import { useLocation, matchPath } from 'react-router-dom'

export default function useCurrentPage (): Page | null {
  const { pathname: currentPath } = useLocation()

  const currentPage = useMemo(() => {
    for (const page of pages) {
      const match = matchPath({ path: page.path }, currentPath)
      if (match != null) {
        return page
      }
    }

    return null
  }, [currentPath])

  return currentPage
}
