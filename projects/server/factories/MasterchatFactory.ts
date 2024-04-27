import { Dependencies } from '@rebel/shared/context/context'
import LogService from '@rebel/server/services/LogService'
import { Masterchat } from '@rebel/masterchat'
import AuthStore from '@rebel/server/stores/AuthStore'
import { createLogContext } from '@rebel/shared/ILogService'
import ContextClass from '@rebel/shared/context/ContextClass'

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

  constructor (deps: Deps) {
    super()
    this.channelId = deps.resolve('channelId')
    this.logService = deps.resolve('logService')
    this.authStore = deps.resolve('authStore')
  }

  public async create (liveId: string): Promise<Masterchat> {
    const auth = await this.authStore.loadYoutubeWebAccessToken(this.channelId)

    if (auth == null) {
      this.logService.logWarning(this, 'Access token is not set in the db for channelId', this.channelId)
    } else {
      this.logService.logInfo(this, 'Successfully loaded access token for channelId', this.channelId)
    }

    this.logService.logDebug(this, 'Created new', auth != null ? 'authenticated' : 'unauthenticated', 'masterchat instance for liveId', liveId)
    const logContext = createLogContext(this.logService, { name: `masterchat[${liveId}]`})
    return new Masterchat(logContext, liveId, this.channelId, { mode: 'live', credentials: auth?.accessToken ?? undefined })
  }
}
