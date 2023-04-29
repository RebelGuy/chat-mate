import { Dependencies } from '@rebel/shared/context/context'
import ContextClass from '@rebel/shared/context/ContextClass'
import RankStore from '@rebel/server/stores/RankStore'
import AuthStore from '@rebel/server/stores/AuthStore'
import { TWITCH_SCOPE } from '@rebel/server/constants'
import { AccessToken } from '@twurple/auth/lib'
import LogService from '@rebel/server/services/LogService'
import WebService from '@rebel/server/services/WebService'

type Deps = Dependencies<{
  twitchClientId: string
  twitchClientSecret: string
  twitchUsername: string
  studioUrl: string
  rankStore: RankStore
  authStore: AuthStore
  logService: LogService
  webService: WebService
}>

export default class AdminService extends ContextClass {
  public readonly name = AdminService.name

  private readonly twitchClientId: string
  private readonly twitchClientSecret: string
  private readonly twitchUsername: string
  private readonly studioUrl: string
  private readonly rankStore: RankStore
  private readonly authStore: AuthStore
  private readonly logService: LogService
  private readonly webService: WebService

  constructor (deps: Deps) {
    super()

    this.twitchClientId = deps.resolve('twitchClientId')
    this.twitchClientSecret = deps.resolve('twitchClientSecret')
    this.twitchUsername = deps.resolve('twitchUsername')
    this.studioUrl = deps.resolve('studioUrl')
    this.rankStore = deps.resolve('rankStore')
    this.authStore = deps.resolve('authStore')
    this.logService = deps.resolve('logService')
    this.webService = deps.resolve('webService')
  }

  /** Returns all current system admin users. */
  public async getAdminUsers (streamerId: number): Promise<{ chatUserId: number}[]> {
    const allRanks = await this.rankStore.getUserRanksForGroup('administration', streamerId)
    return allRanks.filter(r => r.rank.name === 'admin').map(r => ({ chatUserId: r.primaryUserId }))
  }

  public getTwitchLoginUrl (): string {
    const scope = TWITCH_SCOPE.join('+')
    const redirectUrl = this.getRedirectUrl()
    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${this.twitchClientId}&redirect_uri=${redirectUrl}&response_type=code&scope=${scope}`
    return url
  }

  /** The username of the ChatMate Twitch account. */
  public getTwitchUsername (): string {
    return this.twitchUsername
  }

  public async authoriseTwitchLogin (authorisationCode: string): Promise<void> {
    const redirectUrl = this.getRedirectUrl()
    const url = `https://id.twitch.tv/oauth2/token?client_id=${this.twitchClientId}&client_secret=${this.twitchClientSecret}&code=${authorisationCode}&grant_type=authorization_code&redirect_uri=${redirectUrl}`

    const rawResponse = await this.webService.fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
    if (!rawResponse.ok) {
      const message = `Twitch auth response was status ${rawResponse.status}: ${await rawResponse.text()}`
      this.logService.logError(this, `Failed to update Twitch access token. ${message}`)
      throw new Error(message)
    }

    const response = await rawResponse.json() as any
    const token: AccessToken = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      scope: TWITCH_SCOPE,
      expiresIn: 0,
      obtainmentTimestamp: 0
    }

    // we can't get the Twitch user ID because we may not yet have authenticated the API client.
    // this will be set the next time we refresh the token in the TwurpleAuthProvider.
    await this.authStore.saveTwitchAccessToken(null, this.twitchUsername, token)

    this.logService.logInfo(this, `Successfully updated Twitch access token.`)
  }

  private getRedirectUrl () {
    return `${this.studioUrl}/admin/twitch`
  }
}
