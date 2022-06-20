import { Dependencies } from '@rebel/server/context/context'
import LogService from '@rebel/server/services/LogService'
import { Masterchat } from '@rebel/masterchat'
import Factory from '@rebel/server/factories/Factory'

type Deps = Dependencies<{
  channelId: string,
  auth: string,
  logService: LogService
}>

export default class MasterchatFactory extends Factory<Masterchat> {
  readonly name = MasterchatFactory.name

  private readonly channelId: string
  private readonly auth: string
  private readonly logService: LogService

  constructor (deps: Deps) {
    super(null)
    this.channelId = deps.resolve('channelId')
    this.auth = deps.resolve('auth')
    this.logService = deps.resolve('logService')
  }

  public override create (liveId: string): Masterchat {
    this.logService.logDebug(this, 'Created new masterchat for liveId', liveId)
    return new Masterchat(liveId, this.channelId, { mode: 'live', credentials: this.auth })
  }
}
