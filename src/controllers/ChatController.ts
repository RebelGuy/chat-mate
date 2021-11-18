import { Dependencies } from '@rebel/context/ContextProvider'
import { buildPath } from '@rebel/controllers/BaseEndpoint'
import { ChatItem } from '@rebel/models/chat'
import ChatStore from '@rebel/stores/ChatStore'
import { GET, Path, QueryParam } from "typescript-rest"

type GetChatResponse = {
  // include the timestamp so it can easily be used for the next request
  lastTimestamp: number

  // whether the response contains partial chat data or all available chat data
  isPartial: boolean
  chat: ChatItem[]
}

@Path(buildPath('chat'))
export class ChatController {
  readonly chatStore: ChatStore

  constructor (dependencies: Dependencies) {
    this.chatStore = dependencies.resolve<ChatStore>(ChatStore.name)
  }

  @GET
  public getChat (
    // unix timestamp (milliseconds)
    @QueryParam('since') since?: number,
    @QueryParam('limit') limit?: number
  ): GetChatResponse {
    limit = limit ?? Number.MAX_VALUE
    const newerThan = since ?? 0
    const items = this.chatStore.chatItems.filter(c => c.timestamp > newerThan).takeLast(limit)

    return {
      lastTimestamp: items.last()?.timestamp ?? newerThan,
      isPartial: items.size !== this.chatStore.chatItems.size,
      chat: items.toArray()
    }
  }
}
