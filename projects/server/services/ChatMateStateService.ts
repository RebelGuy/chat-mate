import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import VisitorStore from '@rebel/server/stores/VisitorStore'
import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { GroupedSemaphore } from '@rebel/shared/util/Semaphore'
import { ChatMateError } from '@rebel/shared/util/error'

type Deps = Dependencies<{
  dateTimeHelpers: DateTimeHelpers
  visitorStore: VisitorStore
}>

type State = {
  hasInitialisedLivestreamMetadata: boolean
  streamlabsStreamerWebsockets: Map<number, SocketIOClient.Socket>
  masterchatStreamerIdLiveIdMap: Map<number, string>
  masterchatLoggedIn: boolean
  emojiSemaphore: GroupedSemaphore<string>
  customEmojiSemaphore: GroupedSemaphore<number>
  channelSemaphore: GroupedSemaphore<string>
  visitorCountSemaphore: GroupedSemaphore<string>
  visitorCache: Set<string>
  today: number
}

export default class ChatMateStateService extends SingletonContextClass {
  private readonly dateTimeHelpers: DateTimeHelpers
  private readonly visitorStore: VisitorStore

  private state: State

  constructor (deps: Deps) {
    super()

    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
    this.visitorStore = deps.resolve('visitorStore')

    this.state = {
      hasInitialisedLivestreamMetadata: false,
      streamlabsStreamerWebsockets: new Map(),
      masterchatStreamerIdLiveIdMap: new Map(),
      masterchatLoggedIn: false,
      emojiSemaphore: new GroupedSemaphore(1),
      customEmojiSemaphore: new GroupedSemaphore(1),
      channelSemaphore: new GroupedSemaphore(1),
      visitorCountSemaphore: new GroupedSemaphore(1),
      visitorCache: new Set(),
      today: this.dateTimeHelpers.getStartOfToday()
    }
  }

  public override async initialise (): Promise<void> {
    const visitors = await this.visitorStore.getVisitorsForDay(this.state.today)
    visitors.forEach(v => this.state.visitorCache.add(v))
  }

  public hasInitialisedLivestreamMetadata () {
    return this.state.hasInitialisedLivestreamMetadata
  }

  public onInitialisedLivestreamMetadata () {
    if (this.hasInitialisedLivestreamMetadata()) {
      throw new ChatMateError('Livestream metadata has already been initialised')
    }

    this.state.hasInitialisedLivestreamMetadata = true
  }

  public getStreamlabsStreamerWebsockets () {
    return this.state.streamlabsStreamerWebsockets
  }

  public getMasterchatStreamerIdLiveIdMap () {
    return this.state.masterchatStreamerIdLiveIdMap
  }

  public getMasterchatLoggedIn () {
    return this.state.masterchatLoggedIn
  }

  public setMasterchatLoggedIn (isLoggedIn: boolean) {
    this.state.masterchatLoggedIn = isLoggedIn
  }

  public getEmojiSemaphore () {
    return this.state.emojiSemaphore
  }

  public getCustomEmojiSemaphore () {
    return this.state.customEmojiSemaphore
  }

  public getChannelSemaphore () {
    return this.state.channelSemaphore
  }

  public getVisitorCountSemaphore () {
    return this.state.visitorCountSemaphore
  }

  /** Returns true if the visitor was added to the cache (i.e. not yet seen today). */
  public cacheVisitor (visitorId: string): boolean {
    const today = this.dateTimeHelpers.getStartOfToday()
    if (this.state.today !== today) {
      this.state.visitorCache.clear()
      this.state.today = today
    }

    if (this.state.visitorCache.has(visitorId)) {
      return false
    } else {
      this.state.visitorCache.add(visitorId)
      return true
    }
  }
}
