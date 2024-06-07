import { Dependencies } from '@rebel/shared/context/context'
import LogService from '@rebel/server/services/LogService'
import { Masterchat } from '@rebel/masterchat'
import AuthStore from '@rebel/server/stores/AuthStore'
import { createLogContext } from '@rebel/shared/ILogService'
import ContextClass from '@rebel/shared/context/ContextClass'
import ChatMateStateService from '@rebel/server/services/ChatMateStateService'

type Deps = Dependencies<{
  channelId: string
  logService: LogService
  authStore: AuthStore
  chatMateStateService: ChatMateStateService
}>

export default class MasterchatFactory extends ContextClass {
  readonly name = MasterchatFactory.name

  private readonly channelId: string
  private readonly logService: LogService
  private readonly authStore: AuthStore
  private readonly chatMateStateService: ChatMateStateService

  constructor (deps: Deps) {
    super()
    this.channelId = deps.resolve('channelId')
    this.logService = deps.resolve('logService')
    this.authStore = deps.resolve('authStore')
    this.chatMateStateService = deps.resolve('chatMateStateService')
  }

  public async create (liveId: string): Promise<Masterchat> {
    const auth = await this.authStore.loadYoutubeWebAccessToken(this.channelId)
    const logContext = createLogContext(this.logService, { name: `masterchat[${liveId}]`})
    return new Masterchat(
      logContext,
      liveId,
      this.channelId,
      { mode: 'live', credentials: auth?.accessToken ?? undefined },
      loggedOut => this.chatMateStateService.setMasterchatLoggedIn(!loggedOut)
    )
  }
}
