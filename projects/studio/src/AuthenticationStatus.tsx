import { getMasterchatAuthentication } from '@rebel/studio/api'
import ApiRequest from '@rebel/studio/ApiRequest'

export default function AuthenticationStatus () {
  return <ApiRequest onDemand={false} repeatInterval={5000} onRequest={getMasterchatAuthentication}>
    {(authentication) => <div>
      <div style={{ display: 'inline' }}>Masterchat authenticated: </div>
      <div style={{ display: 'inline', color: authentication?.authenticated ? 'green' : 'red' }}>
        {authentication ? String(authentication.authenticated) : 'unknown'}
      </div>
    </div>}
  </ApiRequest>
}
