import { SingletonContextClass } from '@rebel/shared/context/ContextClass'
import { ChatMateError } from '@rebel/shared/util/error'

type State = {
  hasInitialisedLivestreamMetadata: boolean
}

export default class ChatMateStateService extends SingletonContextClass {
  private state: State = {
    hasInitialisedLivestreamMetadata: false
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
}
