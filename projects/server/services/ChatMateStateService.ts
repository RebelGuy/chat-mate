import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import { GroupedSemaphore } from '@rebel/shared/util/Semaphore'
import { ChatMateError } from '@rebel/shared/util/error'

type State = {
  hasInitialisedLivestreamMetadata: boolean
  streamlabsStreamerWebsockets: Map<number, SocketIOClient.Socket>
  masterchatStreamerIdLiveIdMap: Map<number, string>
  masterchatLoggedIn: boolean
  emojiSemaphore: GroupedSemaphore<string>
  customEmojiSemaphore: GroupedSemaphore<number>
}

export default class ChatMateStateService extends SingletonContextClass {
  private state: State = {
    hasInitialisedLivestreamMetadata: false,
    streamlabsStreamerWebsockets: new Map(),
    masterchatStreamerIdLiveIdMap: new Map(),
    masterchatLoggedIn: false,
    emojiSemaphore: new GroupedSemaphore(1),
    customEmojiSemaphore: new GroupedSemaphore(1)
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
}
