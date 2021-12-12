import { Dependencies } from '@rebel/context/context'
import { buildPath } from '@rebel/controllers/BaseEndpoint'
import { privateToPublicItems, PublicChatItem } from '@rebel/models/chat'
import ChatStore from '@rebel/stores/ChatStore'
import { ApiSchema } from '@rebel/types'
import { GET, Path, QueryParam } from "typescript-rest"

type GetChatResponse = ApiSchema<2, {
  liveId: string

  // include the timestamp so it can easily be used for the next request
  lastTimestamp: number

  chat: PublicChatItem[]
}>

@Path(buildPath('chat'))
export class ChatController {
  readonly liveId: string
  readonly chatStore: ChatStore

  constructor (dependencies: Dependencies) {
    this.liveId = dependencies.resolve<string>('liveId')
    this.chatStore = dependencies.resolve<ChatStore>(ChatStore.name)
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
      schema: 2,
      liveId: this.liveId,
      lastTimestamp: items.at(-1)?.time.getTime() ?? since,
      chat: privateToPublicItems(items)
    }
  }
}
