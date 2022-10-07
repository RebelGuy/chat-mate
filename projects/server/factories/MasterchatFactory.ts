import { Dependencies } from '@rebel/server/context/context'
import LogService from '@rebel/server/services/LogService'
import { Masterchat } from '@rebel/masterchat'
import Factory from '@rebel/server/factories/Factory'
import AuthStore from '@rebel/server/stores/AuthStore'

type Deps = Dependencies<{
  channelId: string
  logService: LogService
  authStore: AuthStore
}>

export default class MasterchatFactory extends Factory<Masterchat> {
  readonly name = MasterchatFactory.name

  private readonly channelId: string
  private readonly logService: LogService
  private readonly authStore: AuthStore

  private accessToken!: string | null

  constructor (deps: Deps) {
    super(null)
    this.channelId = deps.resolve('channelId')
    this.logService = deps.resolve('logService')
    this.authStore = deps.resolve('authStore')
  }

  public override async initialise () {
    // todo: later we could modify this so the access token can be updated while the application is running,
    // perhaps via events. masterchat.setCredentials() supports changing the token without instantiating a new instance.
    this.accessToken = await this.authStore.loadYoutubeAccessToken(this.channelId)

    if (this.accessToken == null) {
      this.logService.logWarning(this, 'Access token is not set in the db for channelId', this.channelId)
    }
  }

  public override create (liveId: string): Masterchat {
    this.logService.logDebug(this, 'Created new', this.accessToken ? 'authenticated' : 'unauthenticated', 'masterchat instance for liveId', liveId)
    return new Masterchat(liveId, this.channelId, { mode: 'live', credentials: this.accessToken ?? undefined })
  }
}
