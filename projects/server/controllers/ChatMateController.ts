import { ApiRequest, ApiResponse, buildPath, ControllerBase, Endpoint, Tagged } from '@rebel/server/controllers/ControllerBase'
import { PublicApiStatus } from '@rebel/server/controllers/public/status/PublicApiStatus'
import { PublicChatMateEvent } from '@rebel/server/controllers/public/event/PublicChatMateEvent'
import { PublicLivestreamStatus } from '@rebel/server/controllers/public/status/PublicLivestreamStatus'
import { GET, PATCH, Path, POST, QueryParam } from 'typescript-rest'
import env from '@rebel/server/globals'
import ChatMateControllerReal, { ChatMateControllerDeps } from '@rebel/server/controllers/ChatMateControllerReal'
import ChatMateControllerFake from '@rebel/server/controllers/ChatMateControllerFake'
import { EmptyObject } from '@rebel/server/types'

export type GetStatusResponse = ApiResponse<3, {
  livestreamStatus: Tagged<2, PublicLivestreamStatus> | null
  youtubeApiStatus: Tagged<1, PublicApiStatus>
  twitchApiStatus: Tagged<1, PublicApiStatus>
}>

type GetEventsResponse = ApiResponse<4, {
  // include the timestamp so it can easily be used for the next request
  reusableTimestamp: number
  events: Tagged<3, PublicChatMateEvent>[]
}>

// eslint-disable-next-line @typescript-eslint/ban-types
export type GetStatusEndpoint = Endpoint<3, {}, GetStatusResponse>

export type GetEventsEndpoint = Endpoint<4, { since: number }, GetEventsResponse>

export type SetActiveLivestreamRequest = ApiRequest<2, { schema: 2, livestream: string | null }>
export type SetActiveLivestreamResponse = ApiResponse<2, { livestreamLink: string | null }>
export type SetActiveLivestreamEndpoint = Endpoint<2, Omit<SetActiveLivestreamRequest, 'schema'>, SetActiveLivestreamResponse>

export interface IChatMateController {
  getStatus: GetStatusEndpoint
  getEvents: GetEventsEndpoint
  setActiveLivestream: SetActiveLivestreamEndpoint
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
    const builder = this.registerResponseBuilder<GetStatusResponse>('GET /status', 3)
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
    const builder = this.registerResponseBuilder<GetEventsResponse>('GET /events', 4)
    if (since == null) {
      return builder.failure(400, `A value for 'since' must be provided.`)
    }
    
    try {
      return await this.implementation.getEvents({ builder, since })
    } catch (e: any) {
      return builder.failure(e)
    }
  }

  @PATCH
  @Path('livestream')
  public async setActiveLivestream (request: SetActiveLivestreamRequest): Promise<SetActiveLivestreamResponse> {
    const builder = this.registerResponseBuilder<SetActiveLivestreamResponse>('PATCH /livestream', 2)
    if (request == null || request.livestream === undefined) {
      return builder.failure(400, `A value for 'livestream' must be provided or set to null.`)
    }

    try {
      return await this.implementation.setActiveLivestream({ builder, ...request })
    } catch (e: any) {
      return builder.failure(e)
    }
  }
}
