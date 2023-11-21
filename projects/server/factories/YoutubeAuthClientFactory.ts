import ContextClass from '@rebel/shared/context/ContextClass'
import { OAuth2Client } from 'google-auth-library'

export default class YoutubeAuthClientFactory extends ContextClass {
  public create (clientId: string, clientSecret: string, redirectUri: string) {
    return new OAuth2Client({ clientId, clientSecret, redirectUri })
  }
}
