import LogService from '@rebel/server/services/LogService'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'

type Deps = Dependencies<{
  streamerStore: StreamerStore
  chatMateRegisteredUserName: string
  logService: LogService
}>

// provides on-demand cachable data. better than pre-calculating to save on startup time
export default class CacheService extends ContextClass {
  public readonly name = CacheService.name

  private readonly streamerStore: StreamerStore
  private readonly chatMateRegisteredUserName: string
  private readonly logService: LogService

  private chatMateStreamerId: number | null = null

  constructor (deps: Deps) {
    super()

    this.streamerStore = deps.resolve('streamerStore')
    this.chatMateRegisteredUserName = deps.resolve('chatMateRegisteredUserName')
    this.logService = deps.resolve('logService')
  }

  /** Whether the given streamer is the official ChatMate streamer. */
  public async isChatMateStreamer (streamerId: number): Promise<boolean> {
    if (this.chatMateStreamerId == null) {
      const chatMateStreamer = await this.streamerStore.getStreamerByName(this.chatMateRegisteredUserName)
      if (chatMateStreamer == null) {
        this.logService.logError(this, 'Could not find the official ChatMate streamer.')
        return false
      }

      this.chatMateStreamerId = chatMateStreamer.id
    }

    return this.chatMateStreamerId === streamerId
  }
}
