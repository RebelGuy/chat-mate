import Resolvable from '@rebel/shared/Resolvable'
import StreamerStore from '@rebel/server/stores/StreamerStore'
import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { ChatMateError } from '@rebel/shared/util/error'

type Deps = Dependencies<{
  streamerStore: StreamerStore
  chatMateRegisteredUserName: string
}>

// provides on-demand cachable data. better than pre-calculating to save on startup time
export default class CacheService extends SingletonContextClass {
  public readonly name = CacheService.name

  private readonly streamerStore: StreamerStore
  private readonly chatMateRegisteredUserName: string

  public readonly chatMateStreamerId: Resolvable<number>

  constructor (deps: Deps) {
    super()

    this.streamerStore = deps.resolve('streamerStore')
    this.chatMateRegisteredUserName = deps.resolve('chatMateRegisteredUserName')

    this.chatMateStreamerId = new Resolvable(this.getChatMateStreamerId)
  }

  private getChatMateStreamerId = async (): Promise<number> => {
    const chatMateStreamer = await this.streamerStore.getStreamerByName(this.chatMateRegisteredUserName)
    if (chatMateStreamer == null) {
      throw new ChatMateError('Could not find the official ChatMate streamer.')
    }

    return chatMateStreamer.id
  }
}
