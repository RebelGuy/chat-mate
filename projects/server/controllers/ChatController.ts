import ChatControllerReal, { ChatControllerDeps } from '@rebel/server/controllers/ChatControllerReal'
import ChatControllerFake from '@rebel/server/controllers/ChatControllerFake'
import { ApiResponse, buildPath, ControllerBase, Endpoint, PublicObject } from '@rebel/server/controllers/ControllerBase'
import { PublicChatItem } from '@rebel/server/controllers/public/chat/PublicChatItem'
import env from '@rebel/server/globals'
import { GET, Path, PreProcessor, QueryParam } from 'typescript-rest'
import { requireRank, requireStreamer } from '@rebel/server/controllers/preProcessors'

export type GetChatResponse = ApiResponse<{
  // include the timestamp so it can easily be used for the next request
  reusableTimestamp: number
  chat: PublicObject<PublicChatItem>[]
}>

export type GetChatEndpoint = Endpoint<{ since?: number, limit?: number }, GetChatResponse>

export interface IChatController {
  getChat: GetChatEndpoint
}

@Path(buildPath('chat'))
@PreProcessor(requireStreamer)
@PreProcessor(requireRank('owner'))
export default class ChatController extends ControllerBase {
  private readonly implementation: IChatController

  constructor (deps: ChatControllerDeps) {
    super(deps, 'chat')
    const useFakeControllers = env('useFakeControllers')
    this.implementation = useFakeControllers ? new ChatControllerFake(deps) : new ChatControllerReal(deps)
  }

  @GET
  public async getChat (
    // unix timestamp (milliseconds)
    @QueryParam('since') since?: number,
    @QueryParam('limit') limit?: number
  ): Promise<GetChatResponse> {
    const builder = this.registerResponseBuilder<GetChatResponse>('GET /')
    try {
      return await this.implementation.getChat({
        builder,
        since,
        limit: limit == null || limit > 100 ? 100 : limit
      })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
