import { Dependencies } from '@rebel/server/context/context'
import ContextClass from '@rebel/server/context/ContextClass'
import LogService from '@rebel/server/services/LogService'
import ChannelStore from '@rebel/server/stores/ChannelStore'

type Deps = Dependencies<{
  logService: LogService
  channelStore: ChannelStore
}>

export default class FollowerService extends ContextClass {
  public readonly name = FollowerService.name

  private readonly logService: LogService
  private readonly channelStore: ChannelStore

  constructor (deps: Deps) {
    super()

    this.logService = deps.resolve('logService')
    this.channelStore = deps.resolve('channelStore')
  }

  public async onNewFollower (userId: string, userName: string, userDisplayName: string) {
    try {
      // add new user to channelStore
    } catch (e) {
      this.logService.logError(this, 'Unable to create new user', userName, e)
    }
  }
}
