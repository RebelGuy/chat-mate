import ChatControllerReal, { ChatControllerDeps } from '@rebel/server/controllers/ChatControllerReal'
import ChatControllerFake from '@rebel/server/controllers/ChatControllerFake'
import { ApiResponse, buildPath, ControllerBase, Endpoint, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicChatItem } from '@rebel/server/controllers/public/chat/PublicChatItem'
import env from '@rebel/server/globals'
import { GET, Path, PreProcessor, QueryParam } from 'typescript-rest'
import { requireAuth } from '@rebel/server/controllers/preProcessors'

export type GetChatResponse = ApiResponse<8, {
  // include the timestamp so it can easily be used for the next request
  reusableTimestamp: number
  chat: Tagged<4, PublicChatItem>[]
}>

export type GetChatEndpoint = Endpoint<8, { since?: number, limit?: number }, GetChatResponse>

export interface IChatController {
  getChat: GetChatEndpoint
}

@Path(buildPath('chat'))
@PreProcessor(requireAuth)
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
    const builder = this.registerResponseBuilder<GetChatResponse>('GET /', 8)
    try {
      return await this.implementation.getChat({ builder, since, limit })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
