import { RETURN_URL_QUERY_PARAM } from '@rebel/studio/pages/login/LoginForm'
import { PageLogin } from '@rebel/studio/pages/navigation'
import { useLocation, generatePath, useNavigate } from 'react-router-dom'

/** Use the `onRequireLogin` function to send the user to the login page and have them redirected to the current page upon loggin in. */
export default function useRequireLogin () {
  const { pathname: currentPath } = useLocation()
  const loginPath = generatePath(PageLogin.path)
  const navigate = useNavigate()

  const queryParam = `?${RETURN_URL_QUERY_PARAM}=${currentPath}`
  const onRequireLogin = () => navigate(loginPath + queryParam)
  return { onRequireLogin }
}
