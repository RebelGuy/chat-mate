import DateTimeHelpers from '@rebel/server/helpers/DateTimeHelpers'
import VisitorHelpers from '@rebel/server/helpers/VisitorHelpers'
import VisitorStore from '@rebel/server/stores/VisitorStore'
import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { GroupedSemaphore } from '@rebel/shared/util/Semaphore'
import { ChatMateError } from '@rebel/shared/util/error'

type Deps = Dependencies<{
  dateTimeHelpers: DateTimeHelpers
  visitorStore: VisitorStore
  visitorHelpers: VisitorHelpers
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
  currentTimeString: string
}

export default class ChatMateStateService extends SingletonContextClass {
  private readonly dateTimeHelpers: DateTimeHelpers
  private readonly visitorStore: VisitorStore
  private readonly visitorHelpers: VisitorHelpers

  private state: State

  constructor (deps: Deps) {
    super()

    this.dateTimeHelpers = deps.resolve('dateTimeHelpers')
    this.visitorStore = deps.resolve('visitorStore')
    this.visitorHelpers = deps.resolve('visitorHelpers')

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
      currentTimeString: this.visitorHelpers.getTimeString(this.dateTimeHelpers.now())
    }
  }

  public override async initialise (): Promise<void> {
    const visitors = await this.visitorStore.getVisitorsForTimeString(this.state.currentTimeString)
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

  /** Returns true if the visitor was added to the cache (i.e. not yet seen for this timeString). */
  public cacheVisitor (visitorId: string, timeString: string): boolean {
    if (this.state.currentTimeString !== timeString) {
      this.state.visitorCache.clear()
      this.state.currentTimeString = timeString
    }

    if (this.state.visitorCache.has(visitorId)) {
      return false
    } else {
      this.state.visitorCache.add(visitorId)
      return true
    }
  }
}
