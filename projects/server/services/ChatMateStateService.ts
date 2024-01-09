import ContextClass from '@rebel/shared/context/ContextClass'

type State = {
  hasInitialisedLivestreamMetadata: boolean
}



export default class ChatMateStateService extends ContextClass {
  private state: State = {
    hasInitialisedLivestreamMetadata: false
  }

  public hasInitialisedLivestreamMetadata () {
    return this.state.hasInitialisedLivestreamMetadata
  }

  public onInitialisedLivestreamMetadata () {
    if (this.hasInitialisedLivestreamMetadata()) {
      throw new Error('Livestream metadata has already been initialised')
    }

    this.state.hasInitialisedLivestreamMetadata = true
  }
}
