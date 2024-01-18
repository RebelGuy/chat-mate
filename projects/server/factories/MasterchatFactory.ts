import { Dependencies } from '@rebel/shared/context/context'
import LogService from '@rebel/server/services/LogService'
import { Masterchat } from '@rebel/masterchat'
import AuthStore from '@rebel/server/stores/AuthStore'
import { createLogContext } from '@rebel/shared/ILogService'
import ContextClass from '@rebel/shared/context/ContextClass'
import { YoutubeWebAuth } from '@prisma/client'

type Deps = Dependencies<{
  channelId: string
  logService: LogService
  authStore: AuthStore
}>

export default class MasterchatFactory extends ContextClass {
  readonly name = MasterchatFactory.name

  private readonly channelId: string
  private readonly logService: LogService
  private readonly authStore: AuthStore

  private auth: YoutubeWebAuth | null = null

  constructor (deps: Deps) {
    super()
    this.channelId = deps.resolve('channelId')
    this.logService = deps.resolve('logService')
    this.authStore = deps.resolve('authStore')
  }

  public override async initialise () {
    // todo: later we could modify this so the access token can be updated while the application is running,
    // perhaps via events. masterchat.setCredentials() supports changing the token without instantiating a new instance.
    this.auth = await this.authStore.loadYoutubeWebAccessToken(this.channelId)

    if (this.auth == null) {
      this.logService.logWarning(this, 'Access token is not set in the db for channelId', this.channelId)
    } else {
      this.logService.logInfo(this, 'Successfully loaded access token for channelId', this.channelId)
    }
  }

  public create (liveId: string): Masterchat {
    this.logService.logDebug(this, 'Created new', this.auth != null ? 'authenticated' : 'unauthenticated', 'masterchat instance for liveId', liveId)
    const logContext = createLogContext(this.logService, { name: `masterchat[${liveId}]`})
    return new Masterchat(logContext, liveId, this.channelId, { mode: 'live', credentials: this.auth?.accessToken ?? undefined })
  }
}
