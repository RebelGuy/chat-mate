import { ITask } from '@rebel/server/services/task/TaskService'
import ChatStore from '@rebel/server/stores/ChatStore'
import ContextClass from '@rebel/shared/context/ContextClass'
import { Dependencies } from '@rebel/shared/context/context'
import { unique } from '@rebel/shared/util/arrays'

// context tokens are attached to youtube chat messages and stored in the db.
// masterchat uses context tokens to apply actions to channels (e.g. banning/unbanning),
// however, we retrieve only the context token of the last message written by the user.
// therefore, it is safe to remove previous tokens to save db space.
//
// note: we don't currently use masterchat actions that use the context token, as functionality
// has been deferred to the Youtube API

type Deps = Dependencies<{
  chatStore: ChatStore
}>

export default class CleanUpYoutubeContextTokensTask extends ContextClass implements ITask {
  private readonly chatStore: ChatStore

  constructor (deps: Deps) {
    super()

    this.chatStore = deps.resolve('chatStore')
  }

  public async execute (onLog: (logToAppend: string) => void): Promise<string | null> {
    const chatWithContextToken = await this.chatStore.getChatWithContextToken()
    const streamerIds = unique(chatWithContextToken.map(msg => msg.streamerId))

    for (const streamerId of streamerIds) {
      const chatForStreamer = chatWithContextToken.filter(msg => msg.streamerId === streamerId)

      const channels = new Map<number, number>()
      for (const chat of chatForStreamer) {
        channels.set(chat.youtubeChannelId, chat.id)
      }

      const idsToKeep = [...channels.values()]
      const chatToDelete = chatForStreamer
        .filter(c => !idsToKeep.includes(c.id))
        .map(c => c.id)
      if (chatToDelete.length === 0) {
        continue
      }

      await this.chatStore.deleteContextTokens(chatToDelete)
      onLog(`Deleted ${chatToDelete.length} context tokens for streamer ${streamerId}`)
    }

    return null
  }
}
