import { GlobalOptions } from '@googleapis/youtube'
import { YOUTUBE_SCOPE } from '@rebel/server/constants'
import AuthStore from '@rebel/server/stores/AuthStore'
import StreamerChannelStore from '@rebel/server/stores/StreamerChannelStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { compareArrays, single } from '@rebel/shared/util/arrays'
import { InconsistentScopesError, YoutubeNotAuthorisedError } from '@rebel/shared/util/error'
import { OAuth2Client, Credentials, OAuth2ClientOptions } from 'google-auth-library'

type Deps = Dependencies<{
  authStore: AuthStore
  channelId: string
  clientId: string
  clientSecret: string
  studioUrl: string
}>

// https://github.com/googleapis/google-api-nodejs-client#oauth2-client
export default class YoutubeAuthProvider extends ContextClass {
  private readonly authStore: AuthStore
  private readonly adminChannelId: string
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly studioUrl: string

  constructor (deps: Deps) {
    super()
    this.authStore = deps.resolve('authStore')
    this.adminChannelId = deps.resolve('channelId')
    this.clientId = deps.resolve('clientId')
    this.clientSecret = deps.resolve('clientSecret')
    this.studioUrl = deps.resolve('studioUrl')
  }

  public getAuthUrlForAdmin () {
    const client = this.getClient()

    return client.generateAuthUrl({
      client_id: this.clientId,
      access_type: 'offline', // allow refreshing
      redirect_uri: this.studioUrl + '/admin/youtube', // must match what is set up in the google dev console
      scope: YOUTUBE_SCOPE,
      state: '' // todo: store channel id
    })
  }

  public async authorise (code: string, state: string) {
    const auth = this.getClient()

    const token = await auth.getToken(code).then(res => res.tokens)

    // todo: persist token
  }

  // used for punishments
  public async getAuthForAdmin (): Promise<OAuth2Client> {
    return this.getAuth(this.adminChannelId)
  }

  // used for managing moderators
  public async getAuth (channelId: string): Promise<OAuth2Client> {
    const existingToken = await this.authStore.loadYoutubeAccessToken(channelId)
    if (existingToken == null) {
      throw new YoutubeNotAuthorisedError(channelId)
    }
    // } else if (!compareScopes(YOUTUBE_SCOPE, existingToken.scope)) {
    //   throw new InconsistentScopesError() // todo
    // })

    const client = this.getClient({ redirectUri: this.studioUrl + '/manager' })

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    client.on('tokens', tokens => this.onTokenUpdated(this.adminChannelId, tokens))

    // client.setCredentials(existingToken) // todo

    return client
  }

  private async onTokenUpdated (externalChannelId: string, tokens: Credentials) {
    // todo: save to AuthStore
  }

  // the youtube api won't be used very often, there's no good reason to keep these clients in memorya
  private getClient (options?: OAuth2ClientOptions): OAuth2Client {
    return new OAuth2Client({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      ...options
    })
  }
}

function compareScopes (expected: string[], actual: string[]): boolean {
  return compareArrays([...expected].sort(), [...actual].sort())
}
