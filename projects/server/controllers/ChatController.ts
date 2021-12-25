import { Dependencies } from '@rebel/server/context/context'
import { buildPath } from '@rebel/server/controllers/BaseEndpoint'
import { privateToPublicItems, PublicChatItem } from '@rebel/server/models/chat'
import ChatStore from '@rebel/server/stores/ChatStore'
import { ApiSchema } from '@rebel/server/types'
import { GET, Path, QueryParam } from "typescript-rest"

type GetChatResponse = ApiSchema<3, {
  liveId: string

  // include the timestamp so it can easily be used for the next request
  lastTimestamp: number

  chat: PublicChatItem[]
}>

type Deps = Dependencies<{
  liveId: string,
  chatStore: ChatStore
}>

@Path(buildPath('chat'))
export class ChatController {
  readonly liveId: string
  readonly chatStore: ChatStore

  constructor (dependencies: Deps) {
    this.liveId = dependencies.resolve('liveId')
    this.chatStore = dependencies.resolve('chatStore')
  }

  @GET
  public async getChat (
    // unix timestamp (milliseconds)
    @QueryParam('since') since?: number,
    @QueryParam('limit') limit?: number
  ): Promise<GetChatResponse> {
    since = since ?? 0
    const items = await this.chatStore.getChatSince(since, limit)

    return {
      schema: 3,
      liveId: this.liveId,
      lastTimestamp: items.at(-1)?.time.getTime() ?? since,
      chat: privateToPublicItems(items)
    }
  }
}
