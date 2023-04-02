import { getMasterchatAuthentication } from '@rebel/studio/utility/api'
import useRequest from '@rebel/studio/hooks/useRequest'
import useUpdateKey from '@rebel/studio/hooks/useUpdateKey'

export default function AuthenticationStatus () {
  const [key] = useUpdateKey({ repeatInterval: 5000 })
  const { data } = useRequest(getMasterchatAuthentication(), { updateKey: key })

  return <div>
    <div style={{ display: 'inline' }}>Masterchat authenticated: </div>
    <div style={{ display: 'inline', color: data?.authenticated ? 'green' : 'red' }}>
      {data?.authenticated != null ? String(data?.authenticated) : 'unknown'}
    </div>
  </div>
}
