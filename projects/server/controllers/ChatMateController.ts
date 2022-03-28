import { ApiResponse, buildPath, ControllerBase, Endpoint, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicApiStatus } from '@rebel/server/controllers/public/status/PublicApiStatus'
import { PublicChatMateEvent } from '@rebel/server/controllers/public/event/PublicChatMateEvent'
import { PublicLivestreamStatus } from '@rebel/server/controllers/public/status/PublicLivestreamStatus'
import { GET, Path, QueryParam } from 'typescript-rest'
import env from '@rebel/server/globals'
import ChatMateControllerReal, { ChatMateControllerDeps } from '@rebel/server/controllers/ChatMateControllerReal'
import ChatMateControllerFake from '@rebel/server/controllers/ChatMateControllerFake'

type GetStatusResponse = ApiResponse<2, {
  livestreamStatus: Tagged<1, PublicLivestreamStatus>
  youtubeApiStatus: Tagged<1, PublicApiStatus>
  twitchApiStatus: Tagged<1, PublicApiStatus>
}>

type GetEventsResponse = ApiResponse<2, {
  // include the timestamp so it can easily be used for the next request
  reusableTimestamp: number
  events: Tagged<1, PublicChatMateEvent>[]
}>

// eslint-disable-next-line @typescript-eslint/ban-types
export type GetStatusEndpoint = Endpoint<2, {}, GetStatusResponse>

export type GetEventsEndpoint = Endpoint<2, { since: number }, GetEventsResponse>

export interface IChatMateController {
  getStatus: GetStatusEndpoint
  getEvents: GetEventsEndpoint
}

@Path(buildPath('chatMate'))
export default class ChatMateController extends ControllerBase {
  private readonly implementation: IChatMateController

  constructor (deps: ChatMateControllerDeps) {
    super(deps, 'chatMate')
    const useFakeControllers = env('useFakeControllers')
    this.implementation = useFakeControllers ? new ChatMateControllerFake(deps) : new ChatMateControllerReal(deps)
  }

  @GET
  @Path('status')
  public async getStatus (): Promise<GetStatusResponse> {
    const builder = this.registerResponseBuilder<GetStatusResponse>('GET /status', 2)
    try {
      return await this.implementation.getStatus({ builder })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @GET
  @Path('events')
  public async getEvents (
    @QueryParam('since') since: number
  ): Promise<GetEventsResponse> {
    const builder = this.registerResponseBuilder<GetEventsResponse>('GET /events', 2)
    if (since == null) {
      return builder.failure(400, `A value for 'since' must be provided.`)
    }
    
    try {
      return await this.implementation.getEvents({ builder, since })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
